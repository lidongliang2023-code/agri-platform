package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/** 故障影响重排：仅调整当前采收计划的剩余作业，不修改设备资产、维修台账或其他计划。 */
@Service
public class HarvestFaultRescheduleService {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final HarvestWindowService harvest;
    private final HarvestWeatherService weatherService;
    public HarvestFaultRescheduleService(JdbcTemplate db, ObjectMapper json, HarvestWindowService harvest, HarvestWeatherService weatherService) {
        this.db = db; this.json = json; this.harvest = harvest; this.weatherService = weatherService;
    }

    @Transactional
    public Map<String,Object> preview(String tenant, String planId, Map<String,Object> request) {
        return calculate(tenant, planId, request);
    }

    @Transactional
    public Map<String,Object> apply(String tenant, String planId, Map<String,Object> request, String operator) {
        String reason = required(request.get("reason"), "确认说明", 500);
        Map<String,Object> preview = calculate(tenant, planId, request);
        if (!Objects.equals(preview.get("fingerprint"), request.get("fingerprint")))
            throw new BusinessException(409, "派单、故障或资源数据已变化，请重新预览重排");
        if (!Boolean.TRUE.equals(preview.get("canApply"))) throw new BusinessException(400, "存在阻塞项，不能应用重排");
        String rescheduleId = UUID.randomUUID().toString();
        LocalDateTime now = LocalDateTime.now();
        Map<String,Object> plan = plan(tenant, planId);
        String fallbackMode = s(preview.get("fallbackMode"));
        List<Map<String,Object>> changes = list(preview.get("changes"));
        for (Map<String,Object> change : changes) {
            String sourceId = s(change.get("dispatchId"));
            Map<String,Object> source = db.queryForMap("SELECT * FROM agri_prod_harvest_window_dispatch WHERE tenant_id=? AND plan_id=? AND id=?", tenant, planId, sourceId);
            int people = n(change.get("people")).intValue();
            List<Map<String,Object>> workers = list(change.get("workers"));
            List<Map<String,Object>> machines = list(change.get("machines"));
            if ("NEXT_CYCLE".equals(fallbackMode)) {
                // 下一周期只冻结当前剩余量并留下待复核记录，不创建一个没有日期和资源确认的假派单。
                db.update("UPDATE agri_prod_harvest_window_dispatch_machine SET status=CASE WHEN status='DONE' THEN 'DONE' ELSE 'REPLACED' END,updated_at=? WHERE tenant_id=? AND plan_id=? AND dispatch_id=?", now, tenant, planId, sourceId);
                db.update("UPDATE agri_prod_harvest_window_dispatch SET status='DEFERRED',area=actual_area,people=actual_people,assigned_people=actual_people,unassigned_people=0,note=CONCAT(COALESCE(note,''),'；剩余作业已转入下一周期待复核'),updated_at=? WHERE tenant_id=? AND plan_id=? AND id=?", now, tenant, planId, sourceId);
                change.put("continuationDispatchId", null);
                continue;
            }
            String nextId = UUID.randomUUID().toString();
            boolean outsideWindow = Boolean.TRUE.equals(change.get("outsideWindow"));
            String dispatchNote = outsideWindow ? "窗口外兜底接续单；未经最新真实天气核验不得发布或开工" : "故障重排接续单";
            db.update("INSERT INTO agri_prod_harvest_window_dispatch(id,tenant_id,farm_id,plan_id,plot_id,plot_name,dispatch_date,area,people,assigned_people,unassigned_people,machines,trucks,labor_source,team_name,shift_start,shift_end,planned_hours,actual_people,actual_hours,status,actual_area,note,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    nextId, tenant, plan.get("farm_id"), planId, source.get("plot_id"), source.get("plot_name"), change.get("newDate"), change.get("remainingArea"), people, workers.size(), Math.max(0, people-workers.size()),
                    machines.stream().filter(m -> "HARVESTER".equals(m.get("machine_type"))).count(), machines.stream().filter(m -> "TRUCK".equals(m.get("machine_type"))).count(), "故障重排", source.get("team_name"), "07:00:00", "16:00:00", change.get("plannedHours"), 0, 0, "PLANNED", 0,
                    dispatchNote+"；原派单："+sourceId+"；重排单："+rescheduleId, operator, now, now);
            for (Map<String,Object> w : workers) db.update("INSERT INTO agri_prod_harvest_window_dispatch_worker(id,tenant_id,farm_id,plan_id,dispatch_id,worker_id,worker_no,worker_name,source_type,skill_type,planned_hours,actual_hours,attendance_status,actual_area,note,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    UUID.randomUUID().toString(),tenant,plan.get("farm_id"),planId,nextId,w.get("id"),w.get("worker_no"),w.get("worker_name"),w.get("source_type"),w.get("skill_type"),change.get("plannedHours"),0,"PLANNED",0,outsideWindow ? "窗口外兜底重新匹配" : "故障重排重新匹配",operator,now,now);
            for (Map<String,Object> m : machines) db.update("INSERT INTO agri_prod_harvest_window_dispatch_machine(id,tenant_id,farm_id,plan_id,dispatch_id,machine_type,machine_no,machine_name,operator_worker_id,operator_worker_no,operator_worker_name,planned_hours,actual_hours,planned_area,actual_area,status,note,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    UUID.randomUUID().toString(),tenant,plan.get("farm_id"),planId,nextId,m.get("machine_type"),m.get("machine_no"),m.get("machine_name"),m.get("operator_worker_id"),m.get("operator_worker_no"),m.get("operator_worker_name"),change.get("plannedHours"),0,m.get("remaining_area"),0,"PLANNED",outsideWindow ? "窗口外兜底；原设备明细："+m.get("id") : "故障重排；原设备明细："+m.get("id"),operator,now,now);
            db.update("UPDATE agri_prod_harvest_window_dispatch_machine SET status=CASE WHEN status='DONE' THEN 'DONE' ELSE 'REPLACED' END,updated_at=? WHERE tenant_id=? AND plan_id=? AND dispatch_id=?",now,tenant,planId,sourceId);
            db.update("UPDATE agri_prod_harvest_window_dispatch SET status='RESCHEDULED',area=actual_area,people=actual_people,assigned_people=actual_people,unassigned_people=0,note=CONCAT(COALESCE(note,''),'；剩余作业转接续单：',?),updated_at=? WHERE tenant_id=? AND plan_id=? AND id=?",nextId,now,tenant,planId,sourceId);
            change.put("continuationDispatchId",nextId);
        }
        int version = n(plan.get("version")).intValue()+1;
        Map<String,Object> result = read(plan.get("result_json"));
        result.put("dispatches",harvest.planDetail(tenant,planId).get("dispatches"));
        result.put("lastRescheduleId",rescheduleId);
        Map<String,Object> input=read(plan.get("input_json"));
        input.put("weatherInfo",preview.get("weatherInfo")); input.put("weather",weatherService.days((Map<String,Object>)preview.get("weatherInfo")));
        db.update("UPDATE agri_prod_harvest_window_plan SET input_json=? WHERE tenant_id=? AND id=?",write(input),tenant,planId);
        db.update("UPDATE agri_prod_harvest_window_plan SET version=?,result_json=?,updated_at=? WHERE tenant_id=? AND id=?",version,write(result),now,tenant,planId);
        db.update("INSERT INTO agri_prod_harvest_window_reschedule(id,tenant_id,farm_id,plan_id,fault_id,base_version,new_version,ready_date,fallback_mode,fallback_status,fallback_date,reason,snapshot_json,confirmed_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                rescheduleId,tenant,plan.get("farm_id"),planId,request.get("faultId"),plan.get("version"),version,request.get("readyDate"),fallbackMode,
                "NEXT_CYCLE".equals(fallbackMode) ? "NEXT_CYCLE_PENDING" : (Boolean.TRUE.equals(preview.get("outsideWindowUsed")) ? "OUTSIDE_WINDOW_PENDING_WEATHER" : "WINDOW_CONTINUATION"),
                preview.get("fallbackDate"),reason,write(preview),operator,now);
        db.update("INSERT INTO agri_prod_harvest_window_event(tenant_id,farm_id,plan_id,event_type,payload_json,operator,created_at) VALUES(?,?,?,?,?,?,?)",
                tenant,plan.get("farm_id"),planId,"FAULT_RESCHEDULE_APPLIED",write(Map.of("rescheduleId",rescheduleId,"version",version,"fallbackMode",fallbackMode,"changes",changes,"reason",reason)),operator,now);
        return harvest.planDetail(tenant,planId);
    }

    private Map<String,Object> calculate(String tenant,String planId,Map<String,Object> request) {
        Map<String,Object> plan = plan(tenant,planId);
        if (!Set.of("APPROVED","PUBLISHED").contains(s(plan.get("status")))) throw new BusinessException(400,"仅已确认或已发布计划可故障重排");
        // 同农场内重排与换机共用农场行锁；应用前在锁内重新计算整个方案。
        List<Map<String,Object>> farms = db.queryForList("SELECT id FROM agri_prod_farm_info WHERE tenant_id=? AND id=? FOR UPDATE",tenant,plan.get("farm_id"));
        if (farms.isEmpty()) throw new BusinessException(404,"当前农场不存在");
        String faultId = required(request.get("faultId"),"故障单",36);
        List<Map<String,Object>> faults = db.queryForList("SELECT * FROM agri_prod_harvest_window_machine_fault WHERE tenant_id=? AND plan_id=? AND id=?",tenant,planId,faultId);
        if (faults.isEmpty()) throw new BusinessException(404,"故障单不存在或不属于当前计划");
        Map<String,Object> fault = faults.get(0);
        LocalDate ready;
        try { ready=LocalDate.parse(s(request.get("readyDate"))); } catch(Exception e) { throw new BusinessException(400,"请填写恢复可用日期"); }
        LocalDate windowEnd = day(plan.get("window_end"));
        if (ready.isBefore(LocalDate.now()) || ready.isAfter(windowEnd.plusDays(60))) throw new BusinessException(400,"恢复日期须在今天至计划窗口结束后 60 天之间");
        String fallbackMode = s(request.getOrDefault("fallbackMode", "EXTEND_WINDOW"));
        if (!Set.of("EXTEND_WINDOW", "NEXT_CYCLE").contains(fallbackMode)) throw new BusinessException(400,"窗口外兜底方式不合法");
        LocalDate fallbackDate = parseOptionalDate(request.get("fallbackDate"));
        if ("EXTEND_WINDOW".equals(fallbackMode) && (fallbackDate == null || !fallbackDate.isAfter(windowEnd))) throw new BusinessException(400,"窗口外顺延必须选择计划窗口结束日之后的日期");
        if (fallbackDate != null && fallbackDate.isBefore(ready)) throw new BusinessException(400,"兜底日期不能早于恢复可用日期");
        List<String> blockers = new ArrayList<>(), warnings = new ArrayList<>();
        if ("OPEN".equals(fault.get("status"))) blockers.add("故障尚未完成恢复或换机；可预览影响，处置完成后重新预览再应用");
        Long applied = db.queryForObject("SELECT COUNT(*) FROM agri_prod_harvest_window_reschedule WHERE tenant_id=? AND plan_id=? AND fault_id=?",Long.class,tenant,planId,faultId);
        if (applied!=null && applied>0) blockers.add("此故障已应用重排，不可重复应用");
        List<Map<String,Object>> dispatches=db.queryForList("SELECT * FROM agri_prod_harvest_window_dispatch WHERE tenant_id=? AND plan_id=? ORDER BY dispatch_date,id FOR UPDATE",tenant,planId);
        List<Map<String,Object>> allMachines=db.queryForList("SELECT m.*,d.dispatch_date,d.status dispatch_status FROM agri_prod_harvest_window_dispatch_machine m JOIN agri_prod_harvest_window_dispatch d ON d.id=m.dispatch_id AND d.tenant_id=m.tenant_id WHERE m.tenant_id=? AND m.farm_id=? ORDER BY m.id FOR UPDATE",tenant,plan.get("farm_id"));
        List<Map<String,Object>> allWorkers=db.queryForList("SELECT w.*,d.dispatch_date,d.status dispatch_status FROM agri_prod_harvest_window_dispatch_worker w JOIN agri_prod_harvest_window_dispatch d ON d.id=w.dispatch_id AND d.tenant_id=w.tenant_id WHERE w.tenant_id=? AND w.farm_id=? ORDER BY w.id FOR UPDATE",tenant,plan.get("farm_id"));
        List<Map<String,Object>> library=db.queryForList("SELECT id,worker_no,worker_name,source_type,skill_type,status,max_hours,availability_rate,daily_capacity,available_weekdays,available_from,available_to FROM agri_prod_labor_worker WHERE tenant_id=? AND farm_id=? ORDER BY source_type,worker_no,id FOR UPDATE",tenant,plan.get("farm_id"));
        List<Map<String,Object>> openFaults=db.queryForList("SELECT id,machine_no,status FROM agri_prod_harvest_window_machine_fault WHERE tenant_id=? AND farm_id=? AND status='OPEN' ORDER BY id FOR UPDATE",tenant,plan.get("farm_id"));
        Map<String,Object> weatherInfo=weatherService.latest(tenant, n(plan.get("farm_id")).longValue());
        List<Map<String,Object>> weather=weatherService.days(weatherInfo);
        warnings.add("使用最新真实天气快照；超出预报覆盖期的窗口外安排仅为待核验占位，不允许发布或开工作业；收益不作承诺");
        if (!Boolean.TRUE.equals(weatherInfo.get("usable")) && !"NEXT_CYCLE".equals(fallbackMode)) blockers.add("真实天气未核验或已过期，请刷新真实天气后重新预览");
        Map<String,Object> origin=dispatches.stream().filter(d->s(d.get("id")).equals(s(fault.get("dispatch_id")))).findFirst().orElseThrow(()->new BusinessException(404,"故障原派单不存在"));
        LocalDate originDay=day(origin.get("dispatch_date"));
        List<Map<String,Object>> affected=new ArrayList<>();
        for(Map<String,Object> d:dispatches) {
            String did=s(d.get("id"));
            if(Set.of("DONE","RESCHEDULED").contains(s(d.get("status")))) continue;
            boolean root=did.equals(s(fault.get("dispatch_id")));
            boolean same=allMachines.stream().anyMatch(m->did.equals(s(m.get("dispatch_id"))) && s(fault.get("machine_no")).equals(s(m.get("machine_no"))) && !"REPLACED".equals(m.get("status")));
            if(!root && (!same || day(d.get("dispatch_date")).isBefore(originDay))) continue;
            if(!root && (!"PLANNED".equals(d.get("status")) || n(d.get("actual_area")).signum()>0 || allWorkers.stream().anyMatch(w->did.equals(s(w.get("dispatch_id"))) && (n(w.get("actual_hours")).signum()>0 || !"PLANNED".equals(w.get("attendance_status")))) || allMachines.stream().anyMatch(m->did.equals(s(m.get("dispatch_id"))) && (n(m.get("actual_hours")).signum()>0 || !"PLANNED".equals(m.get("status")))))) {
                blockers.add(s(d.get("plot_name"))+"已有执行记录，需单独处理，不自动移动"); continue;
            }
            if(n(d.get("area")).subtract(n(d.get("actual_area"))).signum()>0) affected.add(d);
        }
        if(affected.isEmpty()) blockers.add("没有可重排的剩余作业");
        Set<String> moved=new HashSet<>(); affected.forEach(d->moved.add(s(d.get("id"))));
        Set<String> busyMachines=new HashSet<>(),busyWorkers=new HashSet<>();
        for(Map<String,Object> m:allMachines) if(!moved.contains(s(m.get("dispatch_id"))) && !"RESCHEDULED".equals(m.get("dispatch_status")) && !"REPLACED".equals(m.get("status"))) {
            busyMachines.add(s(m.get("dispatch_date"))+"/"+s(m.get("machine_no")).toUpperCase(Locale.ROOT));
            if(!s(m.get("operator_worker_id")).isBlank()) busyWorkers.add(s(m.get("dispatch_date"))+"/"+s(m.get("operator_worker_id")));
        }
        for(Map<String,Object> w:allWorkers) if(!moved.contains(s(w.get("dispatch_id"))) && !"RESCHEDULED".equals(w.get("dispatch_status"))) busyWorkers.add(s(w.get("dispatch_date"))+"/"+s(w.get("worker_id")));
        // 原单当日已发生的工时继续占用该日，不因重排释放。
        for(Map<String,Object> m:allMachines) if(moved.contains(s(m.get("dispatch_id"))) && n(m.get("actual_hours")).signum()>0) { busyMachines.add(s(m.get("dispatch_date"))+"/"+s(m.get("machine_no")).toUpperCase(Locale.ROOT)); if(!s(m.get("operator_worker_id")).isBlank()) busyWorkers.add(s(m.get("dispatch_date"))+"/"+s(m.get("operator_worker_id"))); }
        for(Map<String,Object> w:allWorkers) if(moved.contains(s(w.get("dispatch_id"))) && n(w.get("actual_hours")).signum()>0) busyWorkers.add(s(w.get("dispatch_date"))+"/"+s(w.get("worker_id")));
        List<Map<String,Object>> changes=new ArrayList<>();
        for(Map<String,Object> d:affected) {
            String did=s(d.get("id")); BigDecimal remaining=n(d.get("area")).subtract(n(d.get("actual_area"))).max(BigDecimal.ZERO);
            BigDecimal hours=n(d.get("planned_hours")).max(BigDecimal.ONE);
            int people=Math.max(1,(int)Math.ceil(n(d.get("people")).doubleValue()*remaining.doubleValue()/n(d.get("area")).doubleValue()));
            List<Map<String,Object>> equipment=new ArrayList<>();
            for(Map<String,Object> old:allMachines) if(did.equals(s(old.get("dispatch_id"))) && !Set.of("DONE","REPLACED").contains(s(old.get("status")))) {
                Map<String,Object> m=new LinkedHashMap<>(old);
                BigDecimal rem=n(m.get("planned_area")).subtract(n(m.get("actual_area"))).max(BigDecimal.ZERO);
                if(rem.signum()==0) continue;
                m.put("remaining_area",rem);
                if(!did.equals(s(fault.get("dispatch_id"))) && "REPLACED".equals(fault.get("status")) && s(fault.get("machine_no")).equals(s(m.get("machine_no")))) {
                    Map<String,Object> replacement=allMachines.stream().filter(x->s(x.get("id")).equals(s(fault.get("replacement_machine_id")))).findFirst().orElseThrow(()->new BusinessException(409,"替代设备明细已变化"));
                    m.put("machine_no",replacement.get("machine_no"));m.put("machine_name",replacement.get("machine_name"));
                }
                equipment.add(m);
            }
            if (n(d.get("machines")).signum()>0 && equipment.stream().filter(m->"HARVESTER".equals(m.get("machine_type"))).map(m->n(m.get("remaining_area"))).reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(remaining)<0)
                blockers.add(s(d.get("plot_name"))+"剩余农机计划面积不足，请先核对作业实绩");
            LocalDate earliest=day(d.get("dispatch_date")); if(earliest.isBefore(ready)) earliest=ready;
            List<Map<String,Object>> chosenWorkers=List.of(),chosenMachines=List.of(); LocalDate chosen=null;
            List<String> rejected=new ArrayList<>();
            boolean nextCycle = "NEXT_CYCLE".equals(fallbackMode);
            LocalDate firstSearchEnd = windowEnd;
            for(LocalDate candidate=earliest; !candidate.isAfter(firstSearchEnd) && !nextCycle; candidate=candidate.plusDays(1)) {
                String date=candidate.toString();
                String unavailable=weatherService.reason(weatherInfo,candidate);
                if(unavailable!=null) { rejected.add(date+"："+unavailable);continue; }
                boolean conflict=false;
                Set<String> reserved=new HashSet<>(),machineNos=new HashSet<>(); List<Map<String,Object>> matchedMachines=new ArrayList<>();
                for(Map<String,Object> source:equipment) {
                    String no=s(source.get("machine_no")).toUpperCase(Locale.ROOT);
                    if(!machineNos.add(no) || busyMachines.contains(date+"/"+no) || openFaults.stream().anyMatch(f->!faultId.equals(s(f.get("id"))) && no.equals(s(f.get("machine_no")).toUpperCase(Locale.ROOT)))) {conflict=true;break;}
                    String skill="HARVESTER".equals(source.get("machine_type"))?"MACHINE":"DRIVER";
                    Map<String,Object> person=pick(library,candidate,hours,skill,busyWorkers,reserved);
                    if(person==null) {conflict=true;break;}
                    reserved.add(s(person.get("id")));
                    Map<String,Object> m=new LinkedHashMap<>(source);m.put("operator_worker_id",person.get("id"));m.put("operator_worker_no",person.get("worker_no"));m.put("operator_worker_name",person.get("worker_name"));matchedMachines.add(m);
                }
                if(conflict) {rejected.add(date+"：设备冲突、未排除故障或合格机手不足");continue;}
                List<Map<String,Object>> matched=new ArrayList<>();
                for(int i=0;i<people;i++) {Map<String,Object> w=pick(library,candidate,hours,"HARVEST",busyWorkers,reserved); if(w==null)break;matched.add(w);reserved.add(s(w.get("id")));}
                if(matched.size()<people) {rejected.add(date+"：采收人员不足，需要 "+people+" 人，可匹配 "+matched.size()+" 人");continue;}
                chosen=candidate;chosenWorkers=matched;chosenMachines=matchedMachines;break;
            }
            boolean outsideWindow = false;
            if (chosen == null && !nextCycle && fallbackDate != null) {
                for(LocalDate candidate=windowEnd.plusDays(1).isBefore(earliest)?earliest:windowEnd.plusDays(1); !candidate.isAfter(fallbackDate); candidate=candidate.plusDays(1)) {
                    String date=candidate.toString();
                    String unavailable=weatherService.reason(weatherInfo,candidate);
                    boolean noForecast = "无天气预报，不能自动安排".equals(unavailable);
                    if(unavailable!=null && !noForecast) { rejected.add(date+"："+unavailable);continue; }
                    boolean conflict=false;
                    Set<String> reserved=new HashSet<>(),machineNos=new HashSet<>(); List<Map<String,Object>> matchedMachines=new ArrayList<>();
                    for(Map<String,Object> source:equipment) {
                        String no=s(source.get("machine_no")).toUpperCase(Locale.ROOT);
                        if(!machineNos.add(no) || busyMachines.contains(date+"/"+no) || openFaults.stream().anyMatch(f->!faultId.equals(s(f.get("id"))) && no.equals(s(f.get("machine_no")).toUpperCase(Locale.ROOT)))) {conflict=true;break;}
                        String skill="HARVESTER".equals(source.get("machine_type"))?"MACHINE":"DRIVER";
                        Map<String,Object> person=pick(library,candidate,hours,skill,busyWorkers,reserved);
                        if(person==null) {conflict=true;break;}
                        reserved.add(s(person.get("id")));
                        Map<String,Object> m=new LinkedHashMap<>(source);m.put("operator_worker_id",person.get("id"));m.put("operator_worker_no",person.get("worker_no"));m.put("operator_worker_name",person.get("worker_name"));matchedMachines.add(m);
                    }
                    if(conflict) {rejected.add(date+"：设备冲突、未排除故障或合格机手不足");continue;}
                    List<Map<String,Object>> matched=new ArrayList<>();
                    for(int i=0;i<people;i++) {Map<String,Object> w=pick(library,candidate,hours,"HARVEST",busyWorkers,reserved); if(w==null)break;matched.add(w);reserved.add(s(w.get("id")));}
                    if(matched.size()<people) {rejected.add(date+"：采收人员不足，需要 "+people+" 人，可匹配 "+matched.size()+" 人");continue;}
                    chosen=candidate;chosenWorkers=matched;chosenMachines=matchedMachines;outsideWindow=true;
                    if(noForecast) warnings.add(s(d.get("plot_name"))+"顺延至 "+date+"，窗口外暂无天气快照，发布前必须核验真实预报");
                    break;
                }
            }
            Map<String,Object> c=new LinkedHashMap<>();c.put("dispatchId",did);c.put("plotName",d.get("plot_name"));c.put("oldDate",s(d.get("dispatch_date")));c.put("remainingArea",remaining);c.put("completedArea",d.get("actual_area"));c.put("people",people);c.put("plannedHours",hours);c.put("newDate",chosen==null?null:chosen.toString());c.put("workers",chosenWorkers);c.put("machines",chosenMachines);c.put("constraints",rejected);c.put("outsideWindow",outsideWindow);c.put("fallbackStatus",nextCycle ? "NEXT_CYCLE_PENDING" : (outsideWindow ? "OUTSIDE_WINDOW_PENDING_WEATHER" : "WINDOW_CONTINUATION"));
            c.put("delayDays",chosen==null?null:java.time.temporal.ChronoUnit.DAYS.between(day(d.get("dispatch_date")),chosen));
            String originalWeatherRisk = weatherService.shiftReason(weatherInfo,day(d.get("dispatch_date")),d.get("shift_start"),d.get("shift_end"));
            HarvestRescheduleComparison.attach(c, d,
                    allWorkers.stream().filter(w -> did.equals(s(w.get("dispatch_id")))).toList(),
                    allMachines.stream().filter(m -> did.equals(s(m.get("dispatch_id")))).toList(),
                    fallbackMode, "故障影响："+s(fault.get("machine_no"))+"；"+(originalWeatherRisk==null ? "原班次天气核验通过" : originalWeatherRisk),
                    chosen==null ? null : weatherService.reason(weatherInfo,chosen), weatherInfo.get("snapshotId"));
            changes.add(c);
            if(nextCycle) warnings.add(s(d.get("plot_name"))+"剩余 "+remaining+" 亩转入下一周期，待重新核验成熟度、天气和资源");
            else if(chosen==null) blockers.add(s(d.get("plot_name"))+"在窗口内及指定窗口外兜底日期内没有满足天气、用工和农机约束的日期");
            else { for(Map<String,Object> m:chosenMachines) {busyMachines.add(chosen+"/"+s(m.get("machine_no")).toUpperCase(Locale.ROOT));busyWorkers.add(chosen+"/"+m.get("operator_worker_id"));} for(Map<String,Object> w:chosenWorkers)busyWorkers.add(chosen+"/"+w.get("id")); }
        }
        long external=allMachines.stream().filter(m->!planId.equals(s(m.get("plan_id"))) && !Set.of("DONE","RESCHEDULED").contains(s(m.get("dispatch_status"))) && s(fault.get("machine_no")).equals(s(m.get("machine_no"))) && !day(m.get("dispatch_date")).isBefore(ready)).count();
        if(external>0) warnings.add("其他计划有 "+external+" 条同设备安排，本次仅校验占用，请通知对应计划负责人评估");
        if(changes.stream().anyMatch(c->n(c.get("delayDays")).signum()>0)) warnings.add("采收延后存在过熟和等级下降风险，负责人需核验最坏情况兜底");
        boolean outsideWindowUsed = changes.stream().anyMatch(c -> Boolean.TRUE.equals(c.get("outsideWindow")));
        Map<String,Object> out=new LinkedHashMap<>();out.put("faultId",faultId);out.put("readyDate",ready.toString());out.put("fallbackMode",fallbackMode);out.put("fallbackDate",fallbackDate == null ? null : fallbackDate.toString());out.put("baseVersion",plan.get("version"));out.put("changes",changes);out.put("blockers",blockers);out.put("warnings",warnings);out.put("canApply",blockers.isEmpty());out.put("outsideWindowUsed",outsideWindowUsed);
        // 收益使用同一计算域；无明确接续日期的下一周期方案不测算。
        List<Map<String,Object>> benefitRows = changes.stream().map(c -> {
            Map<String,Object> r = new LinkedHashMap<>(c);
            r.put("status", c.get("newDate") == null ? "BLOCKED" : "PROPOSED");
            return r;
        }).toList();
        out.put("benefitSummary", HarvestRescheduleBenefit.attach(benefitRows, request.get("benefitInputs")));
        for (int i=0; i<changes.size(); i++) changes.get(i).put("benefitComparison", benefitRows.get(i).get("benefitComparison"));
        out.put("weatherInfo",weatherInfo);
        out.put("affectedArea",changes.stream().map(c->n(c.get("remainingArea"))).reduce(BigDecimal.ZERO,BigDecimal::add));
        // 指纹覆盖原始资源和实绩，应用时拒绝任何过期预览。
        out.put("fingerprint",digest(write(Arrays.asList(plan,fault,dispatches,allMachines,allWorkers,library,openFaults,out))));return out;
    }

    static Map<String,Object> pick(List<Map<String,Object>> library,LocalDate date,BigDecimal hours,String skill,Set<String> busy,Set<String> reserved) {
        for(Map<String,Object> w:library) {
            if(!"ACTIVE".equals(w.get("status")) || !(skill.equals(w.get("skill_type")) || "MIXED".equals(w.get("skill_type"))))continue;
            if(reserved.contains(s(w.get("id"))) || busy.contains(date+"/"+w.get("id")) || n(w.get("max_hours")).compareTo(hours)<0 || n(w.get("availability_rate")).signum()<=0 || n(w.get("daily_capacity")).signum()<=0) continue;
            if(!Arrays.asList(s(w.get("available_weekdays")).split(",")).contains(String.valueOf(date.getDayOfWeek().getValue())))continue;
            if(w.get("available_from")!=null && date.isBefore(day(w.get("available_from"))) || w.get("available_to")!=null && date.isAfter(day(w.get("available_to"))))continue;
            return w;
        }return null;
    }
    private Map<String,Object> plan(String tenant,String id) {List<Map<String,Object>> plans=db.queryForList("SELECT * FROM agri_prod_harvest_window_plan WHERE tenant_id=? AND id=? FOR UPDATE",tenant,id);if(plans.isEmpty())throw new BusinessException(404,"采收计划不存在");return plans.get(0);}
    private String required(Object v,String field,int max) {String t=s(v).trim();if(t.isEmpty() || t.length()>max)throw new BusinessException(400,field+"须填写1至"+max+"字");return t;}
    private static String s(Object v){return v==null?"":String.valueOf(v);}
    private static BigDecimal n(Object v){return v==null?BigDecimal.ZERO:new BigDecimal(s(v)).setScale(2,RoundingMode.HALF_UP);}
    private static LocalDate day(Object v){return LocalDate.parse(s(v).substring(0,10));}
    private LocalDate parseOptionalDate(Object v){ if(v==null || s(v).isBlank()) return null; try{return LocalDate.parse(s(v).substring(0,10));}catch(Exception e){throw new BusinessException(400,"兜底日期格式应为 yyyy-MM-dd");} }
    private String write(Object v){try{return json.writeValueAsString(v);}catch(Exception e){throw new BusinessException(500,"重排数据序列化失败");}}
    private Map<String,Object> read(Object v){try{return json.readValue(s(v),new TypeReference<>(){});}catch(Exception e){throw new BusinessException(500,"计划输入快照无法读取");}}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> list(Object v){return v instanceof List<?>?(List<Map<String,Object>>)v:List.of();}
    private String digest(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
