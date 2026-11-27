package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;

/** 天气风险批量重排：预览只读，负责人确认后事务创建接续单及审批快照。 */
@Service
public class HarvestRiskBatchPreviewService {
    private final JdbcTemplate db;
    private final HarvestWeatherService weather;
    private final ObjectMapper json;
    private final HarvestWindowService harvest;
    private final byte[] signingKey = new byte[32];
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

    public HarvestRiskBatchPreviewService(JdbcTemplate db, HarvestWeatherService weather, ObjectMapper json, HarvestWindowService harvest) {
        this.db = db; this.weather = weather; this.json = json; this.harvest = harvest;
        new SecureRandom().nextBytes(signingKey);
    }

    @Transactional(readOnly = true)
    public Map<String,Object> preview(String tenant, String planId, Map<String,Object> request) {
        return calculate(tenant, planId, request, false);
    }

    private Map<String,Object> calculate(String tenant, String planId, Map<String,Object> request, boolean locking) {
        String lock = locking ? " FOR UPDATE" : "";
        List<Map<String,Object>> plans = db.queryForList("SELECT * FROM agri_prod_harvest_window_plan WHERE tenant_id=? AND id=?" + lock, tenant, planId);
        if (plans.isEmpty()) throw new BusinessException(404, "采收计划不存在或不属于当前经营主体");
        Map<String,Object> plan = plans.get(0);
        if (locking && db.queryForList("SELECT id FROM agri_prod_farm_info WHERE tenant_id=? AND id=? FOR UPDATE", tenant, plan.get("farm_id")).isEmpty())
            throw new BusinessException(404, "当前农场不存在");
        if (!Set.of("APPROVED", "PUBLISHED").contains(text(plan.get("status"))))
            throw new BusinessException(400, "仅已确认或已发布计划支持风险批量预览");
        if (!(request.get("dispatchIds") instanceof List<?> raw) || raw.isEmpty() || raw.size() > 50)
            throw new BusinessException(400, "请选择1至50张风险派单");
        Set<String> ids = new LinkedHashSet<>();
        for (Object id : raw) {
            if (!(id instanceof String value) || value.isBlank() || value.length() > 36 || !ids.add(value))
                throw new BusinessException(400, "派单编号无效或重复");
        }
        LocalDateTime now = LocalDateTime.now(ZONE);
        LocalDate ready = date(request.get("readyDate")), end = date(request.get("searchEnd"));
        if (ready.isBefore(now.toLocalDate()) || end.isBefore(ready) || end.isAfter(now.toLocalDate().plusDays(60)) || ChronoUnit.DAYS.between(ready, end) > 30)
            throw new BusinessException(400, "搜索日期须从今天起，连续不超过31天，且截止日不超过今天后60天");
        Object farm = plan.get("farm_id");
        List<Map<String,Object>> dispatches = db.queryForList("SELECT * FROM agri_prod_harvest_window_dispatch WHERE tenant_id=? AND farm_id=? ORDER BY dispatch_date,id" + lock, tenant, farm);
        List<Map<String,Object>> selected = dispatches.stream().filter(d -> planId.equals(text(d.get("plan_id"))) && ids.contains(text(d.get("id")))).toList();
        if (selected.size() != ids.size()) throw new BusinessException(404, "包含不存在或不属于当前计划的派单，请刷新后重选");
        List<Map<String,Object>> machines = db.queryForList("SELECT m.*,d.dispatch_date,d.status dispatch_status FROM agri_prod_harvest_window_dispatch_machine m JOIN agri_prod_harvest_window_dispatch d ON d.id=m.dispatch_id AND d.tenant_id=m.tenant_id WHERE m.tenant_id=? AND m.farm_id=? ORDER BY m.id" + lock, tenant, farm);
        List<Map<String,Object>> workers = db.queryForList("SELECT w.*,d.dispatch_date,d.status dispatch_status FROM agri_prod_harvest_window_dispatch_worker w JOIN agri_prod_harvest_window_dispatch d ON d.id=w.dispatch_id AND d.tenant_id=w.tenant_id WHERE w.tenant_id=? AND w.farm_id=? ORDER BY w.id" + lock, tenant, farm);
        List<Map<String,Object>> library = db.queryForList("SELECT * FROM agri_prod_labor_worker WHERE tenant_id=? AND farm_id=? ORDER BY source_type,worker_no,id" + lock, tenant, farm);
        Set<String> faults = new HashSet<>();
        db.queryForList("SELECT machine_no FROM agri_prod_harvest_window_machine_fault WHERE tenant_id=? AND farm_id=? AND status='OPEN' ORDER BY id" + lock, tenant, farm).forEach(f -> faults.add(no(f.get("machine_no"))));
        if (locking) db.queryForList("SELECT id FROM agri_prod_calendar_weather_snapshot WHERE tenant_id=? AND farm_id=? ORDER BY id DESC LIMIT 1 FOR UPDATE", tenant, farm);
        Map<String,Object> snapshot = weather.latest(tenant, ((Number) farm).longValue());
        Map<String,Object> result = simulate(selected, machines, workers, library, faults, snapshot,
                ready, end, date(plan.get("window_end")), now,
                d -> weather.shiftReason(snapshot, date(d.get("dispatch_date")), d.get("shift_start"), d.get("shift_end")));
        for (Map<String,Object> row : maps(result.get("rows"))) {
            String sourceId = text(row.get("dispatchId"));
            Map<String,Object> source = selected.stream().filter(d -> sourceId.equals(text(d.get("id")))).findFirst().orElseThrow();
            HarvestRescheduleComparison.attach(row, source,
                    workers.stream().filter(w -> sourceId.equals(text(w.get("dispatch_id")))).toList(),
                    machines.stream().filter(m -> sourceId.equals(text(m.get("dispatch_id")))).toList(),
                    "WEATHER_RISK_BATCH", text(row.get("riskReason")), null, snapshot.get("snapshotId"));
        }
        result.put("benefitSummary", HarvestRescheduleBenefit.attach(maps(result.get("rows")), request.get("benefitInputs")));
        result.put("planId", planId); result.put("baseVersion", plan.get("version"));
        result.put("snapshotId", snapshot.get("snapshotId")); result.put("weatherExpiresAt", snapshot.get("expiresAt"));
        result.put("generatedAt", now.toString()); result.put("readyDate", ready.toString()); result.put("searchEnd", end.toString());
        result.put("previewOnly", true);
        result.put("canApply", number(result.get("blockedCount")).signum() == 0 && number(result.get("proposedCount")).signum() > 0);
        // 包含整个资源读取集，防止候选恰巧不变时静默接受已变更的资源、实绩或天气。
        Map<String,Object> basis = new LinkedHashMap<>();
        basis.put("tenant", tenant); basis.put("plan", plan); basis.put("dispatches", dispatches);
        basis.put("machines", machines); basis.put("workers", workers); basis.put("library", library);
        basis.put("faults", faults.stream().sorted().toList()); basis.put("weather", snapshot);
        basis.put("ready", ready); basis.put("end", end); basis.put("selected", ids.stream().sorted().toList());
        basis.put("rows", result.get("rows"));
        basis.put("benefitSummary", result.get("benefitSummary"));
        result.put("fingerprint", digest(basis));
        long expiry = now.atZone(ZONE).toEpochSecond() + 900;
        result.put("previewExpiresAt", LocalDateTime.ofInstant(Instant.ofEpochSecond(expiry), ZONE).toString());
        String tokenBody = expiry + "." + result.get("fingerprint");
        result.put("previewToken", tokenBody + "." + sign(tokenBody));
        result.put("warnings", List.of("预览不写入；全部无阻塞且存在候选时，负责人可确认整批应用，生成接续单后需重新发布", "原派单资源占用保守保留；本批候选按原日期、派单编号排序并顺序预留，预览之间不重复用人用机", "窗口外候选只使用有效真实预报，应用前仍须复核成熟度、品质代价和资源；无预报不生成可执行候选", "资源按整日独占口径校验，其他农场设备占用需由设备资产调度域统一复核"));
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String,Object> apply(String tenant, String planId, Map<String,Object> request, String operator) {
        String reason = text(request.get("reason")).trim();
        if (reason.isEmpty() || reason.length() > 500) throw new BusinessException(400, "请填写1至500字的负责人确认说明");
        if (!Boolean.TRUE.equals(request.get("confirmed"))) throw new BusinessException(400, "请确认已核验人员、农机和延期风险");
        String[] token = text(request.get("previewToken")).split("\\.", -1);
        if (token.length != 3 || !MessageDigest.isEqual(sign(token[0]+"."+token[1]).getBytes(StandardCharsets.UTF_8), token[2].getBytes(StandardCharsets.UTF_8)))
            throw new BusinessException(409, "预览凭据无效或服务已更新，请重新计算候选");
        try {
            long expires = Long.parseLong(token[0]);
            long now = Instant.now().getEpochSecond();
            if (expires <= now || expires > now + 905) throw new IllegalArgumentException();
        } catch (Exception e) { throw new BusinessException(409, "预览已过期，请重新计算候选"); }
        Map<String,Object> fresh = calculate(tenant, planId, request, true);
        if (!Objects.equals(token[1], fresh.get("fingerprint"))) throw new BusinessException(409, "计划、天气、人员、设备或候选已变化，请重新计算并确认");
        if (!Boolean.TRUE.equals(fresh.get("canApply"))) throw new BusinessException(409, "整批存在阻塞项或没有可应用候选，请调整勾选后重新预览");
        List<Map<String,Object>> changes = maps(fresh.get("rows")).stream().filter(r -> "PROPOSED".equals(r.get("status"))).toList();
        boolean outside = changes.stream().anyMatch(r -> Boolean.TRUE.equals(r.get("outsideWindow")));
        if (outside && !Boolean.TRUE.equals(request.get("outsideWindowConfirmed"))) throw new BusinessException(400, "窗口外方案须明确确认成熟度、品质损失和延期风险");
        Map<String,Object> plan = db.queryForMap("SELECT * FROM agri_prod_harvest_window_plan WHERE tenant_id=? AND id=?", tenant, planId);
        Object farm = plan.get("farm_id");
        String batchId = UUID.randomUUID().toString();
        LocalDateTime now = LocalDateTime.now(ZONE);
        List<Map<String,Object>> mapping = new ArrayList<>();
        for (Map<String,Object> row : changes) {
            String sourceId = text(row.get("dispatchId")), nextId = UUID.randomUUID().toString();
            Map<String,Object> source = db.queryForMap("SELECT * FROM agri_prod_harvest_window_dispatch WHERE tenant_id=? AND plan_id=? AND id=?", tenant, planId, sourceId);
            List<Map<String,Object>> matchedWorkers = maps(row.get("workers")), matchedMachines = maps(row.get("machines"));
            db.update("INSERT INTO agri_prod_harvest_window_dispatch(id,tenant_id,farm_id,plan_id,plot_id,plot_name,dispatch_date,area,people,assigned_people,unassigned_people,machines,trucks,labor_source,team_name,shift_start,shift_end,planned_hours,actual_people,actual_hours,status,actual_area,note,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                nextId, tenant, farm, planId, source.get("plot_id"), source.get("plot_name"), row.get("newDate"), row.get("remainingArea"), row.get("people"), matchedWorkers.size(), 0, source.get("machines"), source.get("trucks"), "天气风险重排", source.get("team_name"), source.get("shift_start"), source.get("shift_end"), row.get("plannedHours"), 0, 0, "PLANNED", 0,
                "天气风险批量接续单；原派单："+sourceId+"；批次："+batchId+"；负责人已确认，待重新发布", operator, now, now);
            for (Map<String,Object> w : matchedWorkers) {
                Map<String,Object> person = db.queryForMap("SELECT * FROM agri_prod_labor_worker WHERE tenant_id=? AND farm_id=? AND id=?", tenant, farm, w.get("workerId"));
                db.update("INSERT INTO agri_prod_harvest_window_dispatch_worker(id,tenant_id,farm_id,plan_id,dispatch_id,worker_id,worker_no,worker_name,source_type,skill_type,planned_hours,actual_hours,attendance_status,actual_area,note,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    UUID.randomUUID().toString(),tenant,farm,planId,nextId,person.get("id"),person.get("worker_no"),person.get("worker_name"),person.get("source_type"),person.get("skill_type"),row.get("plannedHours"),0,"PLANNED",0,"天气风险批量重排；"+batchId,operator,now,now);
            }
            for (Map<String,Object> m : matchedMachines) {
                Map<String,Object> machine = db.queryForMap("SELECT * FROM agri_prod_harvest_window_dispatch_machine WHERE tenant_id=? AND plan_id=? AND dispatch_id=? AND machine_no=?", tenant,planId,sourceId,m.get("machineNo"));
                Map<String,Object> person = db.queryForMap("SELECT * FROM agri_prod_labor_worker WHERE tenant_id=? AND farm_id=? AND id=?", tenant,farm,m.get("operatorWorkerId"));
                db.update("INSERT INTO agri_prod_harvest_window_dispatch_machine(id,tenant_id,farm_id,plan_id,dispatch_id,machine_type,machine_no,machine_name,operator_worker_id,operator_worker_no,operator_worker_name,planned_hours,actual_hours,planned_area,actual_area,status,note,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    UUID.randomUUID().toString(),tenant,farm,planId,nextId,machine.get("machine_type"),machine.get("machine_no"),machine.get("machine_name"),person.get("id"),person.get("worker_no"),person.get("worker_name"),row.get("plannedHours"),0,machine.get("planned_area"),0,"PLANNED","天气风险批量重排；原明细："+machine.get("id"),operator,now,now);
            }
            int updated = db.update("UPDATE agri_prod_harvest_window_dispatch SET status='RESCHEDULED',area=actual_area,people=actual_people,assigned_people=actual_people,unassigned_people=0,note=CONCAT(COALESCE(note,''),'；天气风险剩余作业转接续单：',?),updated_at=? WHERE tenant_id=? AND plan_id=? AND id=? AND status='PLANNED' AND actual_area=0 AND actual_hours=0 AND actual_people=0",nextId,now,tenant,planId,sourceId);
            if(updated != 1) throw new BusinessException(409,"原派单已开始执行，整批应用已取消");
            db.update("UPDATE agri_prod_harvest_window_dispatch_machine SET status='REPLACED',updated_at=? WHERE tenant_id=? AND plan_id=? AND dispatch_id=?",now,tenant,planId,sourceId);
            mapping.add(Map.of("sourceDispatchId",sourceId,"continuationDispatchId",nextId,"plotName",row.get("plotName"),"newDate",row.get("newDate"),"area",row.get("remainingArea")));
            row.put("continuationDispatchId",nextId);
        }
        int version = number(plan.get("version")).intValue()+1;
        Map<String,Object> input = read(plan.get("input_json")), result = read(plan.get("result_json"));
        Map<String,Object> currentWeather = weather.latest(tenant, ((Number)farm).longValue());
        input.put("weatherInfo",currentWeather); input.put("weather",weather.days(currentWeather));
        result.put("lastRescheduleId",batchId);
        result.put("dispatches",harvest.planDetail(tenant,planId).get("dispatches"));
        db.update("UPDATE agri_prod_harvest_window_plan SET version=?,status='APPROVED',approved_by=?,approved_at=?,input_json=?,result_json=?,updated_at=? WHERE tenant_id=? AND id=?",version,operator,now,write(input),write(result),now,tenant,planId);
        fresh.put("previewOnly",false); fresh.put("changes",changes); fresh.put("reason",reason); fresh.put("confirmedBy",operator); fresh.put("outsideWindowConfirmed",outside); fresh.remove("previewToken");
        db.update("INSERT INTO agri_prod_harvest_window_reschedule(id,tenant_id,farm_id,plan_id,fault_id,base_version,new_version,ready_date,fallback_mode,fallback_status,fallback_date,reason,snapshot_json,confirmed_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            batchId,tenant,farm,planId,null,plan.get("version"),version,request.get("readyDate"),"WEATHER_RISK_BATCH","PENDING_REPUBLISH",null,reason,write(fresh),operator,now);
        db.update("INSERT INTO agri_prod_harvest_window_event(tenant_id,farm_id,plan_id,event_type,payload_json,operator,created_at) VALUES(?,?,?,?,?,?,?)",tenant,farm,planId,"RISK_BATCH_RESCHEDULE_APPLIED",write(Map.of("batchId",batchId,"baseVersion",plan.get("version"),"newVersion",version,"reason",reason,"snapshotId",text(fresh.get("snapshotId")),"changes",mapping)),operator,now);
        return Map.of("benefitSummary",fresh.get("benefitSummary"),"batchId",batchId,"newVersion",version,"appliedCount",changes.size(),"unchangedCount",fresh.get("unchangedCount"),"confirmedBy",operator,"confirmedAt",now.toString(),"status","PENDING_REPUBLISH","changes",mapping);
    }

    private String sign(String value) {
        try { Mac mac=Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(signingKey,"HmacSHA256")); return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8))); }
        catch(Exception e) {throw new IllegalStateException("无法签发预览凭据",e);}
    }
    private String digest(Object value) {
        try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(write(canonical(value)).getBytes(StandardCharsets.UTF_8)));}
        catch(Exception e) {throw new IllegalStateException("无法生成预览摘要",e);}
    }
    private Object canonical(Object value) {
        if(value instanceof Map<?,?> map) { Map<String,Object> out=new TreeMap<>(); map.forEach((k,v)->out.put(text(k),canonical(v))); return out; }
        if(value instanceof Collection<?> list) return list.stream().map(this::canonical).toList();
        return value == null ? null : value instanceof Number ? number(value).stripTrailingZeros().toPlainString() : text(value);
    }
    private String write(Object value) {try {return json.writeValueAsString(value);} catch(Exception e) {throw new BusinessException(500,"重排数据序列化失败");}}
    private Map<String,Object> read(Object value) {try {return json.readValue(text(value),new TypeReference<LinkedHashMap<String,Object>>(){});} catch(Exception e) {throw new BusinessException(500,"原计划快照无法读取");}}
    @SuppressWarnings("unchecked") private static List<Map<String,Object>> maps(Object value) {return (List<Map<String,Object>>) value;}

    /** 纯计算入口，资源来自同租户同农场快照；便于验证批次间竞争和失败单占用。 */
    static Map<String,Object> simulate(List<Map<String,Object>> selected, List<Map<String,Object>> machines,
            List<Map<String,Object>> workers, List<Map<String,Object>> library, Set<String> faults,
            Map<String,Object> snapshot, LocalDate ready, LocalDate end, LocalDate windowEnd,
            LocalDateTime now, Function<Map<String,Object>,String> weatherReason) {
        Set<String> proposedMachines = new HashSet<>(), proposedWorkers = new HashSet<>();
        List<Map<String,Object>> rows = new ArrayList<>();
        List<Map<String,Object>> ordered = selected.stream().sorted(Comparator.comparing((Map<String,Object> d) -> text(d.get("dispatch_date"))).thenComparing(d -> text(d.get("id")))).toList();
        for (Map<String,Object> d : ordered) {
            String id = text(d.get("id"));
            BigDecimal remaining = number(d.get("area")).subtract(number(d.get("actual_area"))).max(BigDecimal.ZERO);
            Map<String,Object> row = new LinkedHashMap<>();
            row.put("dispatchId", id); row.put("plotName", d.get("plot_name")); row.put("oldDate", text(d.get("dispatch_date")));
            row.put("shiftStart", text(d.get("shift_start"))); row.put("shiftEnd", text(d.get("shift_end"))); row.put("remainingArea", remaining);
            row.put("newDate", null); row.put("workers", List.of()); row.put("machines", List.of()); row.put("outsideWindow", false);
            List<String> blockers = new ArrayList<>(); List<Map<String,Object>> rejected = new ArrayList<>();
            row.put("blockers", blockers); row.put("rejectedDates", rejected);
            rows.add(row);
            List<Map<String,Object>> equipment = machines.stream().filter(m -> id.equals(text(m.get("dispatch_id"))) && !Set.of("REPLACED", "DONE").contains(text(m.get("status")))).toList();
            if (!"PLANNED".equals(text(d.get("status"))) || remaining.signum() <= 0) blockers.add("仅待执行且有剩余面积的派单可预览；进行中及故障阻塞单请先走现场或故障处置流程");
            if (number(d.get("actual_area")).signum() > 0 || number(d.get("actual_hours")).signum() > 0 || number(d.get("actual_people")).signum() > 0
                    || workers.stream().anyMatch(w -> id.equals(text(w.get("dispatch_id"))) && (number(w.get("actual_hours")).signum() > 0 || number(w.get("actual_area")).signum() > 0 || !"PLANNED".equals(text(w.get("attendance_status")))))
                    || machines.stream().anyMatch(m -> id.equals(text(m.get("dispatch_id"))) && (number(m.get("actual_hours")).signum() > 0 || number(m.get("actual_area")).signum() > 0 || !"PLANNED".equals(text(m.get("status"))))))
                blockers.add("存在到岗、作业或故障记录，不能按未开工作业自动移动");
            LocalTime start = null, finish = null;
            try { start = LocalTime.parse(text(d.get("shift_start"))); finish = LocalTime.parse(text(d.get("shift_end"))); if (!finish.isAfter(start)) throw new IllegalArgumentException(); }
            catch (Exception e) { blockers.add("班次缺失、无效或跨夜，需先修正班次"); }
            BigDecimal hours = number(d.get("planned_hours"));
            if (hours.signum() <= 0 || start != null && finish != null && hours.doubleValue() > Duration.between(start, finish).toSeconds() / 3600.0) blockers.add("计划工时无效或超过班次时长");
            int people = number(d.get("people")).intValue(); row.put("people", people); row.put("plannedHours", hours);
            if (people < 1 || people > 10000) blockers.add("计划用工人数无效");
            if (equipment.stream().filter(m -> "HARVESTER".equals(m.get("machine_type"))).count() != number(d.get("machines")).intValue()
                    || equipment.stream().filter(m -> "TRUCK".equals(m.get("machine_type"))).count() != number(d.get("trucks")).intValue()) blockers.add("农机明细与派单数量不一致，请先补齐设备");
            if (equipment.stream().anyMatch(m -> no(m.get("machine_no")).isBlank() || !Set.of("HARVESTER", "TRUCK").contains(text(m.get("machine_type"))))) blockers.add("农机编号或类型无效");
            String originalReason = weatherReason.apply(d);
            row.put("riskReason", originalReason != null ? originalReason : text(d.get("weather_block_reason")));
            if (blockers.isEmpty() && originalReason == null && text(d.get("weather_block_reason")).isBlank() && Objects.equals(text(snapshot.get("snapshotId")), text(d.get("weather_snapshot_id")))) {
                row.put("status", "UNCHANGED"); row.put("message", "最新核验已无天气风险，无需重排"); continue;
            }
            if (!Boolean.TRUE.equals(snapshot.get("usable"))) blockers.add("真实天气未核验或已过期，请先刷新真实天气");
            if (!blockers.isEmpty()) { row.put("status", "BLOCKED"); continue; }
            LocalDate earliest = date(d.get("dispatch_date")); if (earliest.isBefore(ready)) earliest = ready;
            for (LocalDate candidate = earliest; !candidate.isAfter(end); candidate = candidate.plusDays(1)) {
                String reason = candidate.equals(now.toLocalDate()) && !candidate.atTime(start).isAfter(now) ? "班次开始时刻已过，不能安排到过去" : null;
                Map<String,Object> trial = new LinkedHashMap<>(d); trial.put("dispatch_date", candidate.toString());
                if (reason == null) reason = weatherReason.apply(trial);
                Set<String> busyM = new HashSet<>(proposedMachines), busyW = new HashSet<>(proposedWorkers);
                String prefix = candidate + "/";
                for (Map<String,Object> m : machines) if (occupied(m, id, candidate) && !"REPLACED".equals(text(m.get("status")))) {
                    busyM.add(prefix + no(m.get("machine_no"))); busyW.add(prefix + text(m.get("operator_worker_id")));
                }
                for (Map<String,Object> w : workers) if (occupied(w, id, candidate)) busyW.add(prefix + text(w.get("worker_id")));
                Set<String> reserved = new HashSet<>(), ownNos = new HashSet<>();
                List<Map<String,Object>> matchedMachines = new ArrayList<>(), matchedWorkers = new ArrayList<>();
                if (reason == null) for (Map<String,Object> m : equipment) {
                    String machineNo = no(m.get("machine_no"));
                    if (!ownNos.add(machineNo) || faults.contains(machineNo) || busyM.contains(prefix + machineNo)) { reason = "设备重复、已有占用或仍有未关闭故障：" + text(m.get("machine_no")); break; }
                    Map<String,Object> operator = HarvestFaultRescheduleService.pick(library, candidate, hours, "HARVESTER".equals(m.get("machine_type")) ? "MACHINE" : "DRIVER", busyW, reserved);
                    if (operator == null) { reason = "合格机手或驾驶员不足（含可用日期与合同工时限制）"; break; }
                    reserved.add(text(operator.get("id")));
                    matchedMachines.add(Map.of("machineType", text(m.get("machine_type")), "machineNo", text(m.get("machine_no")), "machineName", text(m.get("machine_name")), "operatorWorkerId", text(operator.get("id")), "operatorWorkerName", text(operator.get("worker_name"))));
                }
                if (reason == null) {
                    for (int i = 0; i < people; i++) {
                        Map<String,Object> w = HarvestFaultRescheduleService.pick(library, candidate, hours, "HARVEST", busyW, reserved);
                        if (w == null) break;
                        reserved.add(text(w.get("id"))); matchedWorkers.add(Map.of("workerId", text(w.get("id")), "workerName", text(w.get("worker_name"))));
                    }
                    if (matchedWorkers.size() < people) reason = "采收人员不足：需要" + people + "人，可匹配" + matchedWorkers.size() + "人（含合同工时与日期限制）";
                }
                if (reason != null) { rejected.add(Map.of("date", candidate.toString(), "reason", reason)); continue; }
                row.put("newDate", candidate.toString()); row.put("delayDays", ChronoUnit.DAYS.between(date(d.get("dispatch_date")), candidate));
                row.put("workers", matchedWorkers); row.put("machines", matchedMachines); row.put("outsideWindow", candidate.isAfter(windowEnd));
                long harvesterCount = equipment.stream().filter(m -> "HARVESTER".equals(m.get("machine_type"))).count();
                BigDecimal harvestArea = equipment.stream().filter(m -> "HARVESTER".equals(m.get("machine_type"))).map(m -> number(m.get("planned_area"))).reduce(BigDecimal.ZERO, BigDecimal::add);
                if (harvesterCount > 0 && harvestArea.compareTo(remaining) != 0) {
                    row.put("status", "BLOCKED"); blockers.add("采收机计划面积合计与派单剩余面积不一致，请先核对"); break;
                }
                row.put("status", "PROPOSED"); row.put("message", candidate.isAfter(windowEnd) ? "窗口外候选，需负责人复核成熟度与延后代价" : "窗口内候选，尚未应用");
                ownNos.forEach(n -> proposedMachines.add(prefix + n)); reserved.forEach(w -> proposedWorkers.add(prefix + w));
                break;
            }
            if (!row.containsKey("status")) { row.put("status", "BLOCKED"); blockers.add("指定搜索范围内没有满足天气、人员及设备约束的候选日期；可调整日期或转下一周期复核"); }
        }
        Map<String,Object> result = new LinkedHashMap<>(); result.put("rows", rows); result.put("selectedCount", rows.size());
        result.put("proposedCount", rows.stream().filter(r -> "PROPOSED".equals(r.get("status"))).count());
        result.put("blockedCount", rows.stream().filter(r -> "BLOCKED".equals(r.get("status"))).count());
        result.put("unchangedCount", rows.stream().filter(r -> "UNCHANGED".equals(r.get("status"))).count());
        result.put("affectedArea", rows.stream().map(r -> number(r.get("remainingArea"))).reduce(BigDecimal.ZERO, BigDecimal::add));
        return result;
    }
    private static boolean occupied(Map<String,Object> row, String ownId, LocalDate date) {
        return !ownId.equals(text(row.get("dispatch_id"))) && date.toString().equals(text(row.get("dispatch_date")))
                && !Set.of("RESCHEDULED", "DEFERRED").contains(text(row.get("dispatch_status")));
    }
    private static String text(Object v) { return Objects.toString(v, ""); }
    private static String no(Object v) { return text(v).trim().toUpperCase(Locale.ROOT); }
    private static BigDecimal number(Object v) { return v == null ? BigDecimal.ZERO : new BigDecimal(text(v)); }
    private static LocalDate date(Object v) {
        try { return LocalDate.parse(text(v)); } catch (Exception e) { throw new BusinessException(400, "日期无效，请按yyyy-MM-dd填写"); }
    }
}
