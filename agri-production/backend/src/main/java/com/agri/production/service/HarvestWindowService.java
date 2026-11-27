package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 采收窗口决策域：只负责采收窗口、采收面积拆分、用工/农机协同与回写留痕。
 * 采收批次库存、通用农事日历和加工排产分别由各自领域负责。
 */
@Service
public class HarvestWindowService {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final FarmIdResolver farmIdResolver;
    private final LaborWorkerService laborWorkerService;
    private final HarvestWeatherService weatherService;

    public HarvestWindowService(JdbcTemplate db, ObjectMapper json, FarmIdResolver farmIdResolver,
                                LaborWorkerService laborWorkerService, HarvestWeatherService weatherService) {
        this.db = db;
        this.json = json;
        this.farmIdResolver = farmIdResolver;
        this.laborWorkerService = laborWorkerService;
        this.weatherService = weatherService;
    }

    public Map<String, Object> overview(String tenant, String farmId) {
        Long farm = farmIdResolver.resolveFilter(farmId, tenant);
        List<Map<String, Object>> source = db.queryForList(
                "SELECT id plot_id,plot_name,area,expected_harvest_date,current_crop " +
                "FROM agri_prod_plot_info WHERE tenant_id=? AND farm_id=? AND (deleted IS NULL OR deleted=0) " +
                "AND (status IS NULL OR status='active') ORDER BY id", tenant, farm);
        List<Map<String, Object>> plots = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (Map<String, Object> row : source) {
            double area = number(row.get("area"), 0d);
            if (area <= 0) continue;
            LocalDate expected = date(row.get("expected_harvest_date"));
            LocalDate suggested = expected == null ? today.plusDays(1) : expected;
            int maturity = suggested.isBefore(today.plusDays(2)) ? 86 : suggested.isBefore(today.plusDays(5)) ? 74 : 66;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("plotId", String.valueOf(row.get("plot_id")));
            item.put("plotName", row.get("plot_name"));
            item.put("area", area);
            item.put("maturity", maturity);
            item.put("suggestedDate", suggested.toString());
            item.put("suggestedEndDate", maturity >= 82 ? suggested.plusDays(1).toString() : null);
            item.put("category", maturity >= 82 ? "IMMEDIATE" : maturity >= 70 ? "WINDOW" : "NEXT_CYCLE");
            item.put("reason", maturity >= 82 ? "成熟度已达阈值，需在降雨前完成" : maturity >= 70 ? "延后可获得品质提升，避开降雨恢复期" : "成熟度不足，转入下一周期持续观察");
            item.put("sugarGain", maturity >= 70 && maturity < 82 ? 0.8 : 0);
            item.put("gradeGain", maturity >= 70 && maturity < 82 ? "升一档" : "");
            plots.add(item);
        }
        Map<String,Object> weatherInfo = weatherService.latest(tenant, farm);
        List<Map<String,Object>> weather = weatherService.days(weatherInfo);
        Map<String, Object> resources = new LinkedHashMap<>();
        resources.put("availablePeople", 186);
        resources.put("dailyPeople", 140);
        resources.put("machines", 2);
        resources.put("trucks", 6);
        resources.put("dailyWage", 180);
        try {
            Map<String, Object> labor = laborWorkerService.summary(tenant, farmId, today.toString());
            resources.put("availablePeople", labor.getOrDefault("activeCount", 0));
            resources.put("dailyPeople", labor.getOrDefault("availableCount", 0));
            resources.put("dailyWage", labor.getOrDefault("averageDailyWage", 180));
            resources.put("villagePeople", labor.getOrDefault("villageAvailable", 0));
            resources.put("neighboringPeople", labor.getOrDefault("neighboringAvailable", 0));
            resources.put("laborSource", labor.getOrDefault("source", "LABOR_WORKER_LIBRARY"));
        } catch (Exception ignored) {
            // 老环境尚未执行劳务库补丁时，保留原有演示口径，避免采收窗口页面整体不可用。
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("farmId", farmId);
        result.put("source", "LIVE");
        result.put("plots", plots);
        result.put("weather", weather);
        result.put("weatherInfo", weatherInfo);
        result.put("resources", resources);
        List<Map<String, Object>> plans = db.queryForList(
                "SELECT id,plan_no,status,version,window_start,window_end,metrics_json,result_json " +
                "FROM agri_prod_harvest_window_plan WHERE tenant_id=? AND farm_id=? " +
                "ORDER BY created_at DESC LIMIT 1", tenant, farm);
        if (!plans.isEmpty()) result.put("latestPlan", planDetail(tenant, String.valueOf(plans.get(0).get("id"))));
        return result;
    }

    @Transactional
    public Map<String, Object> solve(String tenant, Map<String, Object> request, String operator) {
        request = new LinkedHashMap<>(request);
        Long farm = farmIdResolver.resolveFilter(text(request.get("farmId")), tenant);
        Map<String,Object> verifiedWeather = weatherService.requireFresh(tenant, farm);
        request.put("weather", weatherService.days(verifiedWeather));
        request.put("weatherInfo", verifiedWeather);
        db.queryForList("SELECT id FROM agri_prod_farm_info WHERE tenant_id=? AND id=? FOR UPDATE", tenant, farm);
        LocalDate start = LocalDate.parse(text(request.get("windowStart")));
        LocalDate end = LocalDate.parse(text(request.get("windowEnd")));
        if (end.isBefore(start) || end.isAfter(start.plusDays(7))) throw new BusinessException(400, "采收窗口最多覆盖连续 8 天");
        List<Map<String, Object>> plots = rows(request.get("plots"));
        if (plots.isEmpty()) throw new BusinessException(400, "没有可用于推理的待采地块");
        Map<String, Object> resources = map(request.get("resources"));
        int dailyPeople = integer(resources.get("dailyPeople"), 0);
        if (dailyPeople <= 0) throw new BusinessException(400, "日均可到岗人数必须大于 0");
        List<Map<String, Object>> dispatches = new ArrayList<>();
        double totalArea = 0, immediateArea = 0, delayedArea = 0, nextCycleArea = 0;
        int peak = 0;
        for (Map<String, Object> plot : plots) {
            double area = number(plot.get("area"), 0d);
            if (area <= 0) continue;
            String category = text(plot.get("category"));
            if ("IMMEDIATE".equals(category)) immediateArea += area;
            else if ("WINDOW".equals(category)) delayedArea += area;
            else nextCycleArea += area;
            totalArea += area;
            if ("NEXT_CYCLE".equals(category)) continue;
            LocalDate date = LocalDate.parse(text(plot.get("suggestedDate")));
            if (date.isBefore(start)) date = start;
            if (date.isAfter(end)) date = end;
            while (!date.isAfter(end) && weatherService.reason(verifiedWeather, date) != null) date = date.plusDays(1);
            if (date.isAfter(end)) throw new BusinessException(409, text(plot.get("plotName")) + "在当前窗口没有通过真实天气核验的日期，请调整窗口或转入下一周期");
            plot = new LinkedHashMap<>(plot);
            plot.put("suggestedDate", date.toString());
            int people = Math.max(1, (int) Math.ceil(area / 3.3));
            int machines = Math.max(0, Math.min(1, (int) Math.ceil(area / 220)));
            int trucks = Math.max(1, Math.min(2, (int) Math.ceil(area / 100)));
            Map<String, Object> dispatch = new LinkedHashMap<>();
            dispatch.put("plotId", text(plot.get("plotId")));
            dispatch.put("plotName", text(plot.get("plotName")));
            dispatch.put("dispatchDate", date.toString());
            dispatch.put("area", area);
            dispatch.put("people", people);
            dispatch.put("machines", machines);
            dispatch.put("trucks", trucks);
            dispatch.put("laborSource", people > dailyPeople ? "跨村调剂" : "本村劳务");
            dispatch.put("status", "PLANNED");
            dispatch.put("actualArea", 0);
            dispatches.add(dispatch);
            peak = Math.max(peak, people);
        }
        int laborGap = Math.max(0, peak - dailyPeople);
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("totalArea", round(totalArea));
        metrics.put("immediateArea", round(immediateArea));
        metrics.put("delayedArea", round(delayedArea));
        metrics.put("nextCycleArea", round(nextCycleArea));
        metrics.put("peoplePeak", peak);
        metrics.put("laborGap", laborGap);
        metrics.put("netBenefit", round(delayedArea * 0.8 * 4.2));
        String id = UUID.randomUUID().toString();
        String planNo = "HARV-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map<String,Object> plot : plots) {
            dispatches.stream().filter(d -> text(d.get("plotId")).equals(text(plot.get("plotId")))).findFirst().ifPresent(d -> { plot.put("suggestedDate", d.get("dispatchDate")); plot.remove("suggestedEndDate"); });
        }
        result.put("plots", plots);
        result.put("dispatches", dispatches);
        result.put("metrics", metrics);
        String inputJson = write(request);
        String resultJson = write(result);
        LocalDateTime now = LocalDateTime.now();
        db.update("INSERT INTO agri_prod_harvest_window_plan " +
                "(id,tenant_id,farm_id,plan_no,status,version,window_start,window_end,input_json,result_json,metrics_json,created_by,created_at,updated_at) " +
                "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", id, tenant, farm, planNo, "DRAFT", 1, start, end, inputJson, resultJson, write(metrics), operator, now, now);
        for (Map<String, Object> dispatch : dispatches) insertDispatch(tenant, farm, id, dispatch, operator, now);
        event(tenant, farm, id, "SOLVED", Map.of("dispatchCount", dispatches.size(), "laborGap", laborGap), operator, now);
        return planDetail(tenant, id);
    }

    @Transactional
    public Map<String, Object> approve(String tenant, String id, String reason, String operator) {
        requireReason(reason);
        Map<String, Object> plan = lockedPlan(tenant, id);
        requireStatus(plan, "DRAFT", "仅草稿状态可确认");
        verifyPlanWeather(tenant, plan, operator);
        LocalDateTime now = LocalDateTime.now();
        db.update("UPDATE agri_prod_harvest_window_plan SET status='APPROVED',approved_by=?,approved_at=?,updated_at=? WHERE tenant_id=? AND id=?", operator, now, now, tenant, id);
        event(tenant, longValue(plan.get("farm_id"), 0L), id, "APPROVED", Map.of("reason", reason), operator, now);
        return planDetail(tenant, id);
    }

    @Transactional
    public Map<String, Object> publish(String tenant, String id, String operator) {
        Map<String, Object> plan = lockedPlan(tenant, id);
        requireStatus(plan, "APPROVED", "请先完成基地负责人确认");
        verifyPlanWeather(tenant, plan, operator);
        LocalDateTime now = LocalDateTime.now();
        db.update("UPDATE agri_prod_harvest_window_plan SET status='PUBLISHED',updated_at=? WHERE tenant_id=? AND id=?", now, tenant, id);
        db.update("UPDATE agri_prod_harvest_window_reschedule SET fallback_status='PUBLISHED' WHERE tenant_id=? AND plan_id=? AND fallback_mode='WEATHER_RISK_BATCH' AND fallback_status='PENDING_REPUBLISH'",tenant,id);
        event(tenant, longValue(plan.get("farm_id"), 0L), id, "PUBLISHED", Map.of("writeBack", List.of("harvest_plan", "labor_dispatch", "machine_dispatch")), operator, now);
        return planDetail(tenant, id);
    }

    @Transactional
    public Map<String, Object> progress(String tenant, String id, String dispatchId, Map<String, Object> request, String operator) {
        Map<String, Object> plan = lockedPlan(tenant, id);
        if (!Set.of("APPROVED", "PUBLISHED", "CLOSED").contains(text(plan.get("status")))) throw new BusinessException(400, "当前计划不可回写进度");
        requireActiveDispatch(tenant, id, dispatchId);
        String status = text(request.get("status"));
        if (!Set.of("PLANNED", "RUNNING", "DONE").contains(status)) throw new BusinessException(400, "无效的执行状态");
        if (!"PLANNED".equals(status)) verifyStartWeather(tenant, plan, dispatchId, operator);
        if ("DONE".equals(status)) {
            Integer unfinished = db.queryForObject("SELECT COUNT(*) FROM agri_prod_harvest_window_dispatch_machine WHERE tenant_id=? AND plan_id=? AND dispatch_id=? AND status NOT IN ('DONE','REPLACED')", Integer.class, tenant, id, dispatchId);
            if (unfinished != null && unfinished > 0) throw new BusinessException(400, "请先处理农机故障并完成设备作业后再完成派单");
        }
        Integer faults = db.queryForObject("SELECT COUNT(*) FROM agri_prod_harvest_window_dispatch_machine WHERE tenant_id=? AND plan_id=? AND dispatch_id=? AND status='FAULT'", Integer.class, tenant, id, dispatchId);
        if (faults != null && faults > 0) throw new BusinessException(400, "派单存在未处理农机故障，请先恢复或换机");
        int updated = db.update("UPDATE agri_prod_harvest_window_dispatch SET status=?,actual_area=COALESCE(?,actual_area),note=?,updated_at=? WHERE tenant_id=? AND plan_id=? AND id=?", status, decimal(request.get("actualArea")), text(request.get("note")), LocalDateTime.now(), tenant, id, dispatchId);
        if (updated != 1) throw new BusinessException(404, "用工派单不存在或不属于当前计划");
        recalculateDispatch(tenant, id, dispatchId);
        event(tenant, longValue(plan.get("farm_id"), 0L), id, "PROGRESS_UPDATED", Map.of("dispatchId", dispatchId, "status", status), operator, LocalDateTime.now());
        return planDetail(tenant, id);
    }

    @Transactional
    public Map<String, Object> workerProgress(String tenant, String id, String dispatchId, String workerId,
                                               Map<String, Object> request, String operator) {
        Map<String, Object> plan = lockedPlan(tenant, id);
        if (!Set.of("APPROVED", "PUBLISHED", "CLOSED").contains(text(plan.get("status")))) throw new BusinessException(400, "当前计划不可回写人员进度");
        requireActiveDispatch(tenant, id, dispatchId);
        String attendance = text(request.getOrDefault("attendanceStatus", "PLANNED"));
        if (Set.of("PRESENT", "DONE").contains(attendance)) verifyStartWeather(tenant, plan, dispatchId, operator);
        if (!Set.of("PLANNED", "PRESENT", "ABSENT", "DONE").contains(attendance)) throw new BusinessException(400, "无效的出勤状态");
        BigDecimal actualHours = nonNegativeDecimal(request.get("actualHours"), "实际工时");
        BigDecimal actualArea = nonNegativeDecimal(request.get("actualArea"), "实际采收面积");
        int updated = db.update("UPDATE agri_prod_harvest_window_dispatch_worker SET attendance_status=?,actual_hours=?,actual_area=?,note=?,updated_at=? WHERE tenant_id=? AND plan_id=? AND dispatch_id=? AND worker_id=?",
                attendance, actualHours, actualArea, text(request.get("note")), LocalDateTime.now(), tenant, id, dispatchId, workerId);
        if (updated != 1) throw new BusinessException(404, "派单人员不存在或不属于当前计划");
        recalculateDispatch(tenant, id, dispatchId);
        event(tenant, longValue(plan.get("farm_id"), 0L), id, "WORKER_PROGRESS_UPDATED", Map.of("dispatchId", dispatchId, "workerId", workerId, "attendanceStatus", attendance), operator, LocalDateTime.now());
        return planDetail(tenant, id);
    }

    @Transactional
    public Map<String, Object> machineProgress(String tenant, String id, String dispatchId, String machineId,
                                                Map<String, Object> request, String operator) {
        Map<String, Object> plan = lockedPlan(tenant, id);
        if (!Set.of("APPROVED", "PUBLISHED", "CLOSED").contains(text(plan.get("status")))) throw new BusinessException(400, "当前计划不可回写农机进度");
        String status = text(request.getOrDefault("status", "PLANNED"));
        if (!Set.of("PLANNED", "RUNNING", "DONE").contains(status)) throw new BusinessException(400, "无效的农机执行状态");
        requireExecutablePlan(plan);
        Map<String, Object> machine = lockedMachine(tenant, id, dispatchId, machineId);
        if ("PLANNED".equals(text(machine.get("status"))) && !"PLANNED".equals(status)) verifyStartWeather(tenant, plan, dispatchId, operator);
        if (Set.of("FAULT", "REPLACED").contains(text(machine.get("status"))))
            throw new BusinessException(400, "故障设备须先完成恢复或换机处理，已替换设备不可继续作业");
        BigDecimal actualHours = nonNegativeDecimal(request.get("actualHours"), "农机实际工时");
        BigDecimal actualArea = nonNegativeDecimal(request.get("actualArea"), "农机实际作业面积");
        validateMachineActual(machine, actualHours, actualArea);
        int updated = db.update("UPDATE agri_prod_harvest_window_dispatch_machine SET status=?,actual_hours=?,actual_area=?,note=?,updated_at=? WHERE tenant_id=? AND plan_id=? AND dispatch_id=? AND id=?",
                status, actualHours, actualArea, text(request.get("note")), LocalDateTime.now(), tenant, id, dispatchId, machineId);
        if (updated != 1) throw new BusinessException(404, "农机明细不存在或不属于当前计划");
        recalculateMachineDispatch(tenant, id, dispatchId);
        event(tenant, longValue(plan.get("farm_id"), 0L), id, "MACHINE_PROGRESS_UPDATED", Map.of("dispatchId", dispatchId, "machineId", machineId, "status", status), operator, LocalDateTime.now());
        return planDetail(tenant, id);
    }

    public Map<String, Object> planDetail(String tenant, String id) {
        Map<String, Object> row = db.queryForMap("SELECT * FROM agri_prod_harvest_window_plan WHERE tenant_id=? AND id=?", tenant, id);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("planNo", row.get("plan_no"));
        result.put("status", row.get("status"));
        result.put("version", row.get("version"));
        result.put("windowStart", row.get("window_start"));
        result.put("windowEnd", row.get("window_end"));
        result.put("metrics", readMap(row.get("metrics_json")));
        result.put("weatherInfo", readMap(row.get("input_json")).get("weatherInfo"));
        Map<String, Object> planResult = readMap(row.get("result_json"));
        result.put("plots", planResult.getOrDefault("plots", List.of()));
        List<Map<String, Object>> dispatches = db.queryForList("SELECT id,plot_id plotId,plot_name plotName,dispatch_date dispatchDate,area,people,assigned_people assignedPeople,unassigned_people unassignedPeople,machines,trucks,labor_source laborSource,team_name teamName,shift_start shiftStart,shift_end shiftEnd,planned_hours plannedHours,actual_people actualPeople,actual_hours actualHours,status,actual_area actualArea,note FROM agri_prod_harvest_window_dispatch WHERE tenant_id=? AND plan_id=? ORDER BY dispatch_date,id", tenant, id);
        for (Map<String, Object> dispatch : dispatches) {
            dispatch.put("workers", db.queryForList("SELECT id,worker_id workerId,worker_no workerNo,worker_name workerName,source_type sourceType,skill_type skillType,planned_hours plannedHours,actual_hours actualHours,attendance_status attendanceStatus,actual_area actualArea,note FROM agri_prod_harvest_window_dispatch_worker WHERE tenant_id=? AND plan_id=? AND dispatch_id=? ORDER BY worker_name", tenant, id, dispatch.get("id")));
            dispatch.put("machineDetails", db.queryForList("SELECT id,machine_type machineType,machine_no machineNo,machine_name machineName,operator_worker_id operatorWorkerId,operator_worker_no operatorWorkerNo,operator_worker_name operatorWorkerName,planned_hours plannedHours,actual_hours actualHours,planned_area plannedArea,actual_area actualArea,status,note FROM agri_prod_harvest_window_dispatch_machine WHERE tenant_id=? AND plan_id=? AND dispatch_id=? ORDER BY machine_type,machine_no", tenant, id, dispatch.get("id")));
        }
        for (Map<String, Object> dispatch : dispatches) {
            dispatch.put("machineFaults", db.queryForList("SELECT id,machine_id machineId,machine_no machineNo,machine_name machineName,severity,description,status,reported_at reportedAt,reported_by reportedBy,resolved_at resolvedAt,resolved_by resolvedBy,resolution,replacement_machine_id replacementMachineId,replacement_machine_no replacementMachineNo FROM agri_prod_harvest_window_machine_fault WHERE tenant_id=? AND plan_id=? AND dispatch_id=? ORDER BY reported_at DESC,id", tenant, id, dispatch.get("id")));
        }
        Map<String,Object> latestWeather=weatherService.latest(tenant,longValue(row.get("farm_id"),0L));
        for(Map<String,Object> dispatch:dispatches) {
            dispatch.put("weatherBlockReason", "PLANNED".equals(dispatch.get("status")) ? weatherService.shiftReason(latestWeather,date(dispatch.get("dispatchDate")),dispatch.get("shiftStart"),dispatch.get("shiftEnd")) : null);
            dispatch.put("weatherSnapshotId",latestWeather.get("snapshotId"));
        }
        result.put("dispatches", dispatches);
        result.put("reschedules", db.queryForList("SELECT id,fault_id faultId,base_version baseVersion,new_version newVersion,ready_date readyDate,fallback_mode fallbackMode,fallback_status fallbackStatus,fallback_date fallbackDate,reason,confirmed_by confirmedBy,created_at createdAt,snapshot_json snapshot FROM agri_prod_harvest_window_reschedule WHERE tenant_id=? AND plan_id=? ORDER BY created_at DESC,id", tenant, id));
        result.put("events", db.queryForList("SELECT event_type eventType,operator,created_at createdAt,payload_json payload FROM agri_prod_harvest_window_event WHERE tenant_id=? AND plan_id=? ORDER BY id", tenant, id));
        return result;
    }

    private Map<String, Object> lockedPlan(String tenant, String id) {
        List<Map<String, Object>> rows = db.queryForList("SELECT * FROM agri_prod_harvest_window_plan WHERE tenant_id=? AND id=? FOR UPDATE", tenant, id);
        if (rows.isEmpty()) throw new BusinessException(404, "采收窗口计划不存在");
        return rows.get(0);
    }

    private void insertDispatch(String tenant, Long farm, String planId, Map<String, Object> d, String operator, LocalDateTime now) {
        String dispatchId = UUID.randomUUID().toString();
        LocalDate dispatchDate = LocalDate.parse(text(d.get("dispatchDate")));
        int people = integer(d.get("people"), 0);
        double area = number(d.get("area"), 0d);
        String team = text(d.getOrDefault("teamName", "采收队"));
        double plannedHours = number(d.get("plannedHours"), 8d);
        List<Map<String, Object>> workers = matchWorkers(tenant, farm, dispatchDate, people, text(d.get("plotId")));
        int assigned = workers.size();
        db.update("INSERT INTO agri_prod_harvest_window_dispatch " +
                "(id,tenant_id,farm_id,plan_id,plot_id,plot_name,dispatch_date,area,people,assigned_people,unassigned_people,machines,trucks,labor_source,team_name,shift_start,shift_end,planned_hours,actual_people,actual_hours,status,actual_area,note,created_by,created_at,updated_at) " +
                "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", dispatchId, tenant, farm, planId,
                nullableLong(d.get("plotId")), text(d.get("plotName")), dispatchDate, area, people, assigned, Math.max(0, people - assigned), integer(d.get("machines"), 0), integer(d.get("trucks"), 0), text(d.get("laborSource")), team, "07:00:00", "16:00:00", plannedHours, 0, 0d, "PLANNED", 0d, assigned < people ? "人员库可匹配 " + assigned + " 人，仍缺 " + (people - assigned) + " 人" : "", operator, now, now);
        for (Map<String, Object> worker : workers) {
            db.update("INSERT INTO agri_prod_harvest_window_dispatch_worker(id,tenant_id,farm_id,plan_id,dispatch_id,worker_id,worker_no,worker_name,source_type,skill_type,planned_hours,actual_hours,attendance_status,actual_area,note,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    UUID.randomUUID().toString(), tenant, farm, planId, dispatchId, worker.get("id"), worker.get("workerNo"), worker.get("workerName"), worker.get("sourceType"), worker.get("skillType"), plannedHours, 0d, "PLANNED", 0d, "自动匹配", operator, now, now);
        }
        insertMachineDetails(tenant, farm, planId, dispatchId, dispatchDate,
                integer(d.get("machines"), 0), integer(d.get("trucks"), 0), area, plannedHours, operator, now);
    }

    private void insertMachineDetails(String tenant, Long farm, String planId, String dispatchId, LocalDate date,
                                      int machineCount, int truckCount, double area, double plannedHours,
                                      String operator, LocalDateTime now) {
        Set<String> occupiedOperators = new HashSet<>();
        List<Map<String, Object>> machineOperators = matchMachineOperators(tenant, farm, date, "MACHINE", machineCount, occupiedOperators);
        List<Map<String, Object>> truckOperators = matchMachineOperators(tenant, farm, date, "DRIVER", truckCount, occupiedOperators);
        for (int i = 0; i < machineCount; i++) {
            Map<String, Object> person = i < machineOperators.size() ? machineOperators.get(i) : Map.of();
            insertMachine(tenant, farm, planId, dispatchId, "HARVESTER", "HARV-" + String.format("%02d", i + 1),
                    "采收机" + (i + 1), person, plannedHours, machineCount == 0 ? 0 : area / machineCount, operator, now);
        }
        for (int i = 0; i < truckCount; i++) {
            Map<String, Object> person = i < truckOperators.size() ? truckOperators.get(i) : Map.of();
            insertMachine(tenant, farm, planId, dispatchId, "TRUCK", "TRUCK-" + String.format("%02d", i + 1),
                    "运输车" + (i + 1), person, plannedHours, truckCount == 0 ? 0 : area / truckCount, operator, now);
        }
    }

    private void insertMachine(String tenant, Long farm, String planId, String dispatchId, String machineType,
                               String machineNo, String machineName, Map<String, Object> person,
                               double plannedHours, double plannedArea, String operator, LocalDateTime now) {
        db.update("INSERT INTO agri_prod_harvest_window_dispatch_machine " +
                        "(id,tenant_id,farm_id,plan_id,dispatch_id,machine_type,machine_no,machine_name,operator_worker_id,operator_worker_no,operator_worker_name,planned_hours,actual_hours,planned_area,actual_area,status,note,created_by,created_at,updated_at) " +
                        "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID().toString(), tenant, farm, planId, dispatchId, machineType, machineNo, machineName,
                person.get("id"), person.get("workerNo"), person.get("workerName"), plannedHours, 0d, plannedArea, 0d,
                "PLANNED", person.isEmpty() ? "未匹配机手，待调度" : "按人员库技能自动匹配", operator, now, now);
    }

    private List<Map<String, Object>> matchMachineOperators(String tenant, Long farm, LocalDate date, String skill, int required, Set<String> occupiedOperators) {
        if (required <= 0) return List.of();
        List<Map<String, Object>> candidates = db.queryForList(
                "SELECT id,worker_no workerNo,worker_name workerName FROM agri_prod_labor_worker " +
                        "WHERE tenant_id=? AND farm_id=? AND status='ACTIVE' AND skill_type IN (?, 'MIXED') " +
                        "ORDER BY source_type,worker_name", tenant, farm, skill);
        Set<String> used = new HashSet<>(occupiedOperators);
        used.addAll(db.queryForList(
                "SELECT worker_id FROM agri_prod_harvest_window_dispatch_worker WHERE tenant_id=? AND farm_id=? " +
                        "AND dispatch_id IN (SELECT id FROM agri_prod_harvest_window_dispatch WHERE tenant_id=? AND farm_id=? AND dispatch_date=?)",
                tenant, farm, tenant, farm, date).stream().map(row -> text(row.get("worker_id"))).toList());
        used.addAll(db.queryForList(
                "SELECT operator_worker_id FROM agri_prod_harvest_window_dispatch_machine WHERE tenant_id=? AND farm_id=? " +
                        "AND dispatch_id IN (SELECT id FROM agri_prod_harvest_window_dispatch WHERE tenant_id=? AND farm_id=? AND dispatch_date=?) AND operator_worker_id IS NOT NULL",
                tenant, farm, tenant, farm, date).stream().map(row -> text(row.get("operator_worker_id"))).toList());
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> candidate : candidates) {
            if (result.size() >= required || used.contains(text(candidate.get("id"))) || !workerAvailable(candidate, date)) continue;
            result.add(candidate);
            used.add(text(candidate.get("id")));
            occupiedOperators.add(text(candidate.get("id")));
        }
        return result;
    }

    private List<Map<String, Object>> matchWorkers(String tenant, Long farm, LocalDate date, int required, String plotId) {
        if (required <= 0) return List.of();
        List<Map<String, Object>> candidates = db.queryForList("SELECT id,worker_no workerNo,worker_name workerName,source_type sourceType,skill_type skillType,availability_rate availabilityRate,daily_capacity dailyCapacity,available_weekdays availableWeekdays,available_from availableFrom,available_to availableTo FROM agri_prod_labor_worker WHERE tenant_id=? AND farm_id=? AND status='ACTIVE' ORDER BY source_type,worker_name", tenant, farm);
        Set<String> used = new HashSet<>();
        for (Map<String, Object> row : db.queryForList("SELECT worker_id FROM agri_prod_harvest_window_dispatch_worker WHERE tenant_id=? AND farm_id=? AND dispatch_id IN (SELECT id FROM agri_prod_harvest_window_dispatch WHERE tenant_id=? AND farm_id=? AND dispatch_date=?)", tenant, farm, tenant, farm, date)) used.add(text(row.get("worker_id")));
        List<Map<String, Object>> result = new ArrayList<>();
        int target = Math.min(required, candidates.size());
        for (Map<String, Object> row : candidates) {
            if (result.size() >= target || used.contains(text(row.get("id")))) continue;
            if (!workerAvailable(row, date)) continue;
            result.add(row);
        }
        return result;
    }

    private boolean workerAvailable(Map<String, Object> row, LocalDate date) {
        String weekdays = text(row.getOrDefault("availableWeekdays", "1,2,3,4,5,6,7"));
        if (!Arrays.asList(weekdays.split(",")).contains(String.valueOf(date.getDayOfWeek().getValue()))) return false;
        LocalDate from = date(row.get("availableFrom")), to = date(row.get("availableTo"));
        if ((from != null && date.isBefore(from)) || (to != null && date.isAfter(to))) return false;
        return number(row.get("availabilityRate"), 100d) > 0 && integer(row.get("dailyCapacity"), 1) > 0;
    }

    private void recalculateDispatch(String tenant, String planId, String dispatchId) {
        Map<String, Object> sum = db.queryForMap("SELECT COUNT(*) workerCount,COUNT(CASE WHEN attendance_status IN ('PRESENT','DONE') THEN 1 END) actualPeople,COALESCE(SUM(actual_hours),0) actualHours,COALESCE(SUM(actual_area),0) actualArea FROM agri_prod_harvest_window_dispatch_worker WHERE tenant_id=? AND plan_id=? AND dispatch_id=?", tenant, planId, dispatchId);
        int workerCount = integer(sum.get("workerCount"), 0);
        db.update("UPDATE agri_prod_harvest_window_dispatch SET actual_people=?,actual_hours=?,actual_area=GREATEST(?,COALESCE((SELECT SUM(m.actual_area) FROM agri_prod_harvest_window_dispatch_machine m WHERE m.tenant_id=? AND m.plan_id=? AND m.dispatch_id=? AND m.machine_type='HARVESTER'),0),CASE WHEN ?=0 THEN actual_area ELSE 0 END),updated_at=? WHERE tenant_id=? AND plan_id=? AND id=?", integer(sum.get("actualPeople"), 0), number(sum.get("actualHours"), 0d), number(sum.get("actualArea"), 0d), tenant, planId, dispatchId, workerCount, LocalDateTime.now(), tenant, planId, dispatchId);
    }

    private void recalculateMachineDispatch(String tenant, String planId, String dispatchId) {
        Map<String, Object> sum = db.queryForMap("SELECT COUNT(CASE WHEN status='FAULT' THEN 1 END) faultCount,COALESCE(SUM(actual_hours),0) machineHours,COALESCE(SUM(CASE WHEN machine_type='HARVESTER' THEN actual_area ELSE 0 END),0) harvestArea FROM agri_prod_harvest_window_dispatch_machine WHERE tenant_id=? AND plan_id=? AND dispatch_id=?", tenant, planId, dispatchId);
        // 运输面积不再叠加到采收面积，换下设备的已完成面积保留在采收汇总中。
        db.update("UPDATE agri_prod_harvest_window_dispatch SET actual_hours=GREATEST(actual_hours,?),actual_area=GREATEST(actual_area,?),status=CASE WHEN ?>0 THEN 'BLOCKED' WHEN status='BLOCKED' THEN 'RUNNING' ELSE status END,updated_at=? WHERE tenant_id=? AND plan_id=? AND id=?", number(sum.get("machineHours"), 0d), number(sum.get("harvestArea"), 0d), integer(sum.get("faultCount"), 0), LocalDateTime.now(), tenant, planId, dispatchId);
    }

    private void requireExecutablePlan(Map<String, Object> plan) {
        if (!Set.of("APPROVED", "PUBLISHED").contains(text(plan.get("status"))))
            throw new BusinessException(400, "仅已确认或已发布计划可处理农机故障与进度");
    }

    private Map<String, Object> lockedMachine(String tenant, String planId, String dispatchId, String machineId) {
        requireActiveDispatch(tenant, planId, dispatchId);
        List<Map<String, Object>> machines = db.queryForList("SELECT m.*,d.dispatch_date FROM agri_prod_harvest_window_dispatch_machine m JOIN agri_prod_harvest_window_dispatch d ON d.id=m.dispatch_id AND d.tenant_id=m.tenant_id AND d.plan_id=m.plan_id WHERE m.tenant_id=? AND m.plan_id=? AND m.dispatch_id=? AND m.id=? FOR UPDATE", tenant, planId, dispatchId, machineId);
        if (machines.isEmpty()) throw new BusinessException(404, "农机明细不存在或不属于当前计划");
        return machines.get(0);
    }

    private void requireActiveDispatch(String tenant, String planId, String dispatchId) {
        List<Map<String,Object>> dispatches = db.queryForList("SELECT status FROM agri_prod_harvest_window_dispatch WHERE tenant_id=? AND plan_id=? AND id=?", tenant, planId, dispatchId);
        if (dispatches.isEmpty()) throw new BusinessException(404, "派单不存在或不属于当前计划");
        if (Set.of("RESCHEDULED", "DEFERRED").contains(text(dispatches.get(0).get("status")))) throw new BusinessException(409, "此派单剩余作业已转接续单或下一周期，请在有效接续单中回写");
        Integer pending = db.queryForObject("SELECT COUNT(*) FROM agri_prod_harvest_window_reschedule WHERE tenant_id=? AND plan_id=? AND fallback_mode='WEATHER_RISK_BATCH' AND fallback_status='PENDING_REPUBLISH'",Integer.class,tenant,planId);
        if (pending != null && pending > 0) throw new BusinessException(409,"天气风险重排已确认，请重新发布计划后再执行或回写派单");
    }

    private void validateMachineActual(Map<String, Object> machine, BigDecimal hours, BigDecimal area) {
        if (hours.compareTo(decimal(machine.get("planned_hours"))) > 0 || area.compareTo(decimal(machine.get("planned_area"))) > 0)
            throw new BusinessException(400, "实际工时和作业面积不得超过本设备计划量");
        if (hours.compareTo(decimal(machine.get("actual_hours"))) < 0 || area.compareTo(decimal(machine.get("actual_area"))) < 0)
            throw new BusinessException(400, "累计作业实绩不可减少");
    }

    @Transactional
    public Map<String, Object> reportMachineFault(String tenant, String id, String dispatchId, String machineId,
                                                 Map<String, Object> request, String operator) {
        Map<String, Object> plan = lockedPlan(tenant, id);
        requireExecutablePlan(plan);
        Map<String, Object> machine = lockedMachine(tenant, id, dispatchId, machineId);
        if (Set.of("DONE", "REPLACED").contains(text(machine.get("status")))) throw new BusinessException(400, "已完成或已替换设备不可登记故障");
        Integer count = db.queryForObject("SELECT COUNT(*) FROM agri_prod_harvest_window_machine_fault WHERE tenant_id=? AND machine_id=? AND status='OPEN'", Integer.class, tenant, machineId);
        if (count != null && count > 0) throw new BusinessException(409, "设备已有未处理故障，请勿重复登记");
        String description = requiredText(request.get("description"), "故障描述", 500);
        String severity = text(request.get("severity"));
        if (!Set.of("GENERAL", "CRITICAL").contains(severity)) throw new BusinessException(400, "请选择一般故障或严重故障");
        BigDecimal hours = nonNegativeDecimal(request.getOrDefault("actualHours", machine.get("actual_hours")), "实际工时");
        BigDecimal area = nonNegativeDecimal(request.getOrDefault("actualArea", machine.get("actual_area")), "实际作业面积");
        validateMachineActual(machine, hours, area);
        LocalDateTime now = LocalDateTime.now();
        String faultId = UUID.randomUUID().toString();
        db.update("INSERT INTO agri_prod_harvest_window_machine_fault(id,tenant_id,farm_id,plan_id,dispatch_id,machine_id,machine_no,machine_name,severity,description,status,reported_by,reported_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", faultId, tenant, plan.get("farm_id"), id, dispatchId, machineId, machine.get("machine_no"), machine.get("machine_name"), severity, description, "OPEN", operator, now);
        db.update("UPDATE agri_prod_harvest_window_dispatch_machine SET status='FAULT',actual_hours=?,actual_area=?,updated_at=? WHERE tenant_id=? AND plan_id=? AND dispatch_id=? AND id=?", hours, area, now, tenant, id, dispatchId, machineId);
        recalculateMachineDispatch(tenant, id, dispatchId);
        event(tenant, longValue(plan.get("farm_id"), 0), id, "MACHINE_FAULT_REPORTED", Map.of("faultId", faultId, "machineId", machineId, "description", description, "severity", severity), operator, now);
        return planDetail(tenant, id);
    }

    @Transactional
    public Map<String, Object> resolveMachineFault(String tenant, String id, String dispatchId, String machineId,
                                                  String faultId, Map<String, Object> request, String operator) {
        Map<String, Object> plan = lockedPlan(tenant, id);
        requireExecutablePlan(plan);
        Map<String, Object> machine = lockedMachine(tenant, id, dispatchId, machineId);
        List<Map<String, Object>> faults = db.queryForList("SELECT * FROM agri_prod_harvest_window_machine_fault WHERE tenant_id=? AND plan_id=? AND dispatch_id=? AND machine_id=? AND id=? FOR UPDATE", tenant, id, dispatchId, machineId, faultId);
        if (faults.isEmpty()) throw new BusinessException(404, "故障记录不存在或不属于当前派单");
        if (!"OPEN".equals(text(faults.get(0).get("status"))) || !"FAULT".equals(text(machine.get("status")))) throw new BusinessException(409, "故障已处理，请刷新后重试");
        String action = text(request.get("action"));
        if (!Set.of("RECOVER", "REPLACE").contains(action)) throw new BusinessException(400, "处理方式只能是恢复作业或更换设备");
        String resolution = requiredText(request.get("resolution"), "处理说明", 500);
        LocalDateTime now = LocalDateTime.now();
        String replacementId = null, replacementNo = null;
        if ("REPLACE".equals(action)) {
            replacementNo = requiredText(request.get("replacementMachineNo"), "替代设备编号", 64);
            String replacementName = requiredText(request.get("replacementMachineName"), "替代设备名称", 128);
            if (replacementNo.equalsIgnoreCase(text(machine.get("machine_no")))) throw new BusinessException(400, "替代设备不能与故障设备相同");
            BigDecimal remaining = decimal(machine.get("planned_area")).subtract(decimal(machine.get("actual_area")));
            BigDecimal remainingHours = decimal(machine.get("planned_hours")).subtract(decimal(machine.get("actual_hours")));
            if (remaining.signum() <= 0 || remainingHours.signum() <= 0) throw new BusinessException(400, "无剩余面积或班次工时，不能换机，请恢复后完成或另行排程");
            // 同农场所有设备分配在农场行锁内串行化，避免并发换机占用同一编号。
            db.queryForList("SELECT id FROM agri_prod_farm_info WHERE tenant_id=? AND id=? FOR UPDATE", tenant, plan.get("farm_id"));
            Integer occupied = db.queryForObject("SELECT COUNT(*) FROM agri_prod_harvest_window_dispatch_machine m JOIN agri_prod_harvest_window_dispatch d ON d.id=m.dispatch_id AND d.tenant_id=m.tenant_id WHERE m.tenant_id=? AND m.farm_id=? AND m.machine_no=? AND (d.dispatch_date=? OR m.status IN ('FAULT','REPLACED'))", Integer.class, tenant, plan.get("farm_id"), replacementNo, machine.get("dispatch_date"));
            if (occupied != null && occupied > 0) throw new BusinessException(409, "替代设备当天已被派单占用或有未恢复故障，请选择其他设备");
            replacementId = UUID.randomUUID().toString();
            db.update("INSERT INTO agri_prod_harvest_window_dispatch_machine(id,tenant_id,farm_id,plan_id,dispatch_id,machine_type,machine_no,machine_name,operator_worker_id,operator_worker_no,operator_worker_name,planned_hours,actual_hours,planned_area,actual_area,status,note,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", replacementId, tenant, plan.get("farm_id"), id, dispatchId, machine.get("machine_type"), replacementNo, replacementName, machine.get("operator_worker_id"), machine.get("operator_worker_no"), machine.get("operator_worker_name"), remainingHours, 0, remaining, 0, "PLANNED", "故障替换，承接剩余作业；原故障单：" + faultId, operator, now, now);
        }
        db.update("UPDATE agri_prod_harvest_window_dispatch_machine SET status=?,updated_at=? WHERE tenant_id=? AND plan_id=? AND dispatch_id=? AND id=?", "RECOVER".equals(action) ? "RUNNING" : "REPLACED", now, tenant, id, dispatchId, machineId);
        db.update("UPDATE agri_prod_harvest_window_machine_fault SET status=?,resolution=?,resolved_by=?,resolved_at=?,replacement_machine_id=?,replacement_machine_no=? WHERE tenant_id=? AND id=? AND status='OPEN'", "RECOVER".equals(action) ? "RECOVERED" : "REPLACED", resolution, operator, now, replacementId, replacementNo, tenant, faultId);
        recalculateMachineDispatch(tenant, id, dispatchId);
        event(tenant, longValue(plan.get("farm_id"), 0), id, "RECOVER".equals(action) ? "MACHINE_FAULT_RECOVERED" : "MACHINE_FAULT_REPLACED", Map.of("faultId", faultId, "machineId", machineId, "resolution", resolution, "replacementMachineNo", replacementNo == null ? "" : replacementNo), operator, now);
        return planDetail(tenant, id);
    }

    private String requiredText(Object value, String label, int max) {
        String result = text(value).trim();
        if (result.isBlank() || result.length() > max) throw new BusinessException(400, label + "须填写1至" + max + "字");
        return result;
    }

    private BigDecimal nonNegativeDecimal(Object value, String field) {
        BigDecimal result = decimal(value);
        if (result == null) return BigDecimal.ZERO;
        if (result.signum() < 0) throw new BusinessException(400, field + "不能为负数");
        return result;
    }

    private void event(String tenant, Long farm, String planId, String type, Object payload, String operator, LocalDateTime now) {
        db.update("INSERT INTO agri_prod_harvest_window_event(tenant_id,farm_id,plan_id,event_type,payload_json,operator,created_at) VALUES(?,?,?,?,?,?,?)", tenant, farm, planId, type, write(payload), operator, now);
    }

    @Transactional
    public Map<String,Object> verifyWeather(String tenant,String planId,String operator) {
        Map<String,Object> plan=lockedPlan(tenant,planId);
        if("CLOSED".equals(plan.get("status"))) throw new BusinessException(409,"已关闭计划不可重新核验");
        verifyPlanWeather(tenant,plan,operator);
        return planDetail(tenant,planId);
    }

    private void verifyPlanWeather(String tenant, Map<String,Object> plan, String operator) {
        Map<String,Object> weather = weatherService.requireFresh(tenant, longValue(plan.get("farm_id"), 0L));
        List<Map<String,Object>> dispatches=db.queryForList("SELECT id,plot_name,dispatch_date,shift_start,shift_end FROM agri_prod_harvest_window_dispatch WHERE tenant_id=? AND plan_id=? AND status='PLANNED'",tenant,plan.get("id"));
        for(Map<String,Object> d:dispatches) {
            String reason=weatherService.shiftReason(weather,date(d.get("dispatch_date")),d.get("shift_start"),d.get("shift_end"));
            if(reason!=null) throw new BusinessException(409,text(d.get("plot_name"))+" "+d.get("dispatch_date")+"："+reason+"，请先重排");
        }
        recordWeather(tenant,plan,weather,operator);
        db.update("UPDATE agri_prod_harvest_window_reschedule SET fallback_status='OUTSIDE_WINDOW_VERIFIED' WHERE tenant_id=? AND plan_id=? AND fallback_status='OUTSIDE_WINDOW_PENDING_WEATHER'",tenant,plan.get("id"));
    }

    private void verifyStartWeather(String tenant, Map<String,Object> plan, String dispatchId, String operator) {
        List<Map<String,Object>> rows=db.queryForList("SELECT status,dispatch_date,shift_start,shift_end,actual_area,actual_hours FROM agri_prod_harvest_window_dispatch WHERE tenant_id=? AND plan_id=? AND id=?",tenant,plan.get("id"),dispatchId);
        if(rows.isEmpty()) throw new BusinessException(404,"派单不存在");
        Map<String,Object> d=rows.get(0);
        // 只校验尚未开工的派单，历史实绩回补不以今天的预报覆盖当时事实。
        if(!"PLANNED".equals(d.get("status")) || number(d.get("actual_hours"),0d)>0 || number(d.get("actual_area"),0d)>0) return;
        Map<String,Object> weather=weatherService.requireFresh(tenant,longValue(plan.get("farm_id"),0L));
        String reason=weatherService.shiftReason(weather,date(d.get("dispatch_date")),d.get("shift_start"),d.get("shift_end"));
        if(reason!=null) throw new BusinessException(409,"派单天气核验未通过："+reason);
        recordWeather(tenant,plan,weather,operator);
    }

    private void recordWeather(String tenant,Map<String,Object> plan,Map<String,Object> weather,String operator) {
        Map<String,Object> input=readMap(plan.get("input_json"));
        input.put("weather",weatherService.days(weather)); input.put("weatherInfo",weather);
        db.update("UPDATE agri_prod_harvest_window_plan SET input_json=?,updated_at=? WHERE tenant_id=? AND id=?",write(input),LocalDateTime.now(),tenant,plan.get("id"));
        event(tenant,longValue(plan.get("farm_id"),0L),text(plan.get("id")),"WEATHER_VERIFIED",Map.of("snapshotId",weather.get("snapshotId"),"fetchedAt",weather.get("fetchedAt"),"ruleVersion",weather.get("ruleVersion")),operator,LocalDateTime.now());
    }

    private void requireStatus(Map<String, Object> plan, String status, String message) { if (!status.equals(text(plan.get("status")))) throw new BusinessException(400, message); }
    private void requireReason(String reason) { if (reason == null || reason.isBlank() || reason.length() > 500) throw new BusinessException(400, "请填写 1 至 500 字的确认说明"); }
    private String write(Object value) { try { return json.writeValueAsString(value); } catch (Exception e) { throw new BusinessException(500, "计划数据序列化失败"); } }
    private Map<String, Object> readMap(Object value) { try { if (value == null) return new LinkedHashMap<>(); return json.readValue(String.valueOf(value), new TypeReference<>() {}); } catch (Exception e) { return new LinkedHashMap<>(); } }
    @SuppressWarnings("unchecked") private List<Map<String, Object>> rows(Object value) { if (!(value instanceof List<?> list)) return new ArrayList<>(); return (List<Map<String, Object>>) (List<?>) list; }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { if (!(value instanceof Map<?, ?> m)) return new LinkedHashMap<>(); return (Map<String, Object>) m; }
    private static String text(Object value) { return value == null ? "" : String.valueOf(value); }
    private static int integer(Object value, int fallback) { try { return value == null ? fallback : Integer.parseInt(String.valueOf(value)); } catch (Exception e) { return fallback; } }
    private static double number(Object value, double fallback) { try { return value == null ? fallback : Double.parseDouble(String.valueOf(value)); } catch (Exception e) { return fallback; } }
    private static Long number(Object value, Long fallback) { try { return value == null ? fallback : Long.valueOf(String.valueOf(value)); } catch (Exception e) { return fallback; } }
    private static long longValue(Object value, long fallback) { try { return value == null ? fallback : Long.parseLong(String.valueOf(value)); } catch (Exception e) { return fallback; } }
    private static Long nullableLong(Object value) { String text = text(value); return text.isBlank() ? null : number(text, null); }
    private static BigDecimal decimal(Object value) { if (value == null || text(value).isBlank()) return null; return BigDecimal.valueOf(number(value, 0d)); }
    private static double round(double value) { return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue(); }
    private static LocalDate date(Object value) { if (value == null || text(value).isBlank()) return null; return value instanceof LocalDate d ? d : LocalDate.parse(text(value).substring(0, 10)); }
}
