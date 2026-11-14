package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.dto.CalendarArrangeRequest;
import com.agri.production.dto.CalendarArrangeRequest.Operation;
import com.agri.production.dto.TaskSaveDTO;
import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.agri.common.ai.client.AgriAiClient;
import com.agri.common.ai.dto.AiInvokeRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** 编排仅产生建议；审核下发复用任务域，任务执行/验收是完成状态的唯一依据。 */
@Service
public class CalendarArrangementService {
    private final JdbcTemplate db; private final ObjectMapper json; private final FarmIdResolver farmIds;
    private final FarmMapper farms; private final PlantingPlanMapper plans; private final PlanStageMapper stages;
    private final TeamMemberMapper members; private final TaskMapper taskMapper; private final ITaskService tasks; private final AgriAiClient ai; private final CalendarWeatherService weather;
    public CalendarArrangementService(JdbcTemplate db,ObjectMapper json,FarmIdResolver farmIds,FarmMapper farms,
            PlantingPlanMapper plans,PlanStageMapper stages,TeamMemberMapper members,TaskMapper taskMapper,ITaskService tasks,AgriAiClient ai,CalendarWeatherService weather) {
        this.db=db;this.json=json;this.farmIds=farmIds;this.farms=farms;this.plans=plans;this.stages=stages;this.members=members;this.taskMapper=taskMapper;this.tasks=tasks;this.ai=ai;this.weather=weather;
    }
    public Map<String,Object> context(String tenant,String farmId) {
        Long farm=ownedFarm(tenant,farmId); access(tenant,farm,false);
        var ps=plans.selectList(new LambdaQueryWrapper<PlantingPlan>().eq(PlantingPlan::getTenantId,tenant).eq(PlantingPlan::getFarmId,farm));
        List<Map<String,Object>> options=new ArrayList<>();
        for(var p:ps) {
            if(Set.of("terminated","completed","cancelled","3","4").contains(Objects.toString(p.getPlanStatus(),""))) continue;
            var ss=stages.selectList(new LambdaQueryWrapper<PlanStage>().eq(PlanStage::getTenantId,tenant).eq(PlanStage::getPlanId,p.getId()).orderByAsc(PlanStage::getStageSeq));
            for(var s:ss) {
                if(!Set.of(1,2).contains(s.getStatus()==null?1:s.getStatus())) continue;
                Map<String,Object> row=new LinkedHashMap<>();row.put("planId",p.getId());row.put("stageId",s.getStageId());row.put("planName",p.getPlanName());row.put("plotName",p.getPlotName());row.put("cropName",p.getCropName());row.put("variety",p.getCropVariety());row.put("stageName",s.getStageName());row.put("earliest",s.getPlanStartDate());row.put("latest",s.getPlanEndDate());row.put("taskType",s.getTaskType());row.put("source",s.getDescription());options.add(row);
            }
        }
        return Map.of("stages",options,"members",members.selectList(new LambdaQueryWrapper<TeamMember>().eq(TeamMember::getTenantId,tenant).eq(TeamMember::getFarmId,String.valueOf(farm)).eq(TeamMember::getStatus,1)),"notice","阶段日期来自既有种植计划，不代表已接入积温模型；人员技能、日容量与天气须据实核验。");
    }
    public List<Map<String,Object>> list(String tenant,String farmId) {
        Long farm=ownedFarm(tenant,farmId); access(tenant,farm,false);
        return db.queryForList("SELECT id,week_start weekStart,status,revision,created_at createdAt,updated_at updatedAt FROM agri_prod_calendar_arrangement WHERE tenant_id=? AND farm_id=? ORDER BY created_at DESC LIMIT 100",tenant,farm);
    }
    @Transactional
    public Map<String,Object> create(String tenant,CalendarArrangeRequest input) {
        Long farm=ownedFarm(tenant,input.farmId()); access(tenant,farm,true); lockFarm(tenant,farm);
        if(input.requestId()==null || !input.requestId().matches("[a-zA-Z0-9_-]{8,64}")) fail("请求编号无效");
        String encoded=encode(input),hash=hash(encoded);
        var existing=db.queryForList("SELECT id,request_hash FROM agri_prod_calendar_arrangement WHERE tenant_id=? AND request_id=?",tenant,input.requestId());
        if(!existing.isEmpty()) { if(!hash.equals(existing.get(0).get("request_hash"))) throw new BusinessException(409,"请求编号已用于另一份内容");return detail(tenant,String.valueOf(existing.get(0).get("id"))); }
        input=weather.refreshInput(tenant,farms.selectById(farm),input);
        var refreshedEncoded=encode(input);
        var result=compute(tenant,farm,input); String id=UUID.randomUUID().toString();
        db.update("INSERT INTO agri_prod_calendar_arrangement(id,tenant_id,farm_id,week_start,request_id,request_hash,status,revision,input_json,result_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,'DRAFT',1,?,?,?,?,?)",id,tenant,farm,input.weekStart(),input.requestId(),hash,refreshedEncoded,encode(result),operator(),LocalDateTime.now(),LocalDateTime.now());
        event(tenant,id,"GENERATED",Map.of("engine","CONSTRAINT_V1","snapshot",input,"result",result));return detail(tenant,id);
    }
    @Transactional
    public Map<String,Object> revise(String tenant,String id,int revision,String reason,CalendarArrangeRequest input) {
        var row=lock(tenant,id); Long farm=((Number)row.get("farm_id")).longValue();access(tenant,farm,true);expect(row,revision);note(reason);
        if(!Set.of("DRAFT","APPROVED").contains(row.get("status"))) fail("已下发或已关闭的编排不可改写，请在原任务管理调整并留痕");
        if(!farm.equals(ownedFarm(tenant,input.farmId()))) fail("不能更换编排所属农场");
        input=weather.refreshInput(tenant,farms.selectById(farm),input);
        var result=compute(tenant,farm,input);preserveCrossMonth(row,result);
        event(tenant,id,"REVISED",Map.of("reason",reason,"beforeInput",decode(row.get("input_json")),"beforeResult",decodeList(row.get("result_json")),"afterInput",input,"afterResult",result));
        LocalDate oldStart=java.time.LocalDate.parse(row.get("week_start").toString());
        if(!java.time.YearMonth.from(oldStart).equals(java.time.YearMonth.from(input.weekStart()))) {
            result.forEach(item->item.put("crossMonth",true));
        }
        db.update("UPDATE agri_prod_calendar_arrangement SET week_start=?,input_json=?,result_json=?,ai_json=NULL,status='DRAFT',approved_by=NULL,cross_month_by=NULL,revision=revision+1,updated_at=? WHERE id=? AND tenant_id=?",input.weekStart(),encode(input),encode(result),LocalDateTime.now(),id,tenant);return detail(tenant,id);
    }
    @Transactional
    public Map<String,Object> approve(String tenant,String id,int revision,String reason,boolean crossMonthConfirmed) {
        var row=lock(tenant,id);Long farm=((Number)row.get("farm_id")).longValue();access(tenant,farm,true);expect(row,revision);note(reason);
        if(!"DRAFT".equals(row.get("status"))) fail("仅草稿可审核");
        var input=input(row);input=weather.refreshInput(tenant,farmEntity(tenant,farm),input);var fresh=compute(tenant,farm,input);preserveCrossMonth(row,fresh);ensureReady(fresh);
        if(!encode(fresh).equals(encode(decodeList(row.get("result_json"))))) throw new BusinessException(409,"占用或天气条件已变化，请调整/重新编排后再审核");
        boolean cross=fresh.stream().anyMatch(x->Boolean.TRUE.equals(x.get("crossMonth")));
        if(cross) { if(!crossMonthConfirmed) fail("跨月编排须技术员明确确认");technician(tenant,farm); }
        db.update("UPDATE agri_prod_calendar_arrangement SET input_json=?,status='APPROVED',approved_by=?,cross_month_by=?,revision=revision+1,updated_at=? WHERE id=? AND tenant_id=?",encode(input),operator(),cross?operator():null,LocalDateTime.now(),id,tenant);
        event(tenant,id,"APPROVED",Map.of("reason",reason,"crossMonthConfirmed",cross));return detail(tenant,id);
    }
    @Transactional
    public Map<String,Object> publish(String tenant,String id,int revision) {
        var row=lock(tenant,id);Long farm=((Number)row.get("farm_id")).longValue();access(tenant,farm,true);
        if("PUBLISHED".equals(row.get("status"))) return detail(tenant,id);
        expect(row,revision);if(!"APPROVED".equals(row.get("status"))) fail("请先审核编排草稿");lockFarm(tenant,farm);
        var input=input(row);input=weather.refreshInput(tenant,farmEntity(tenant,farm),input);var fresh=compute(tenant,farm,input);preserveCrossMonth(row,fresh);ensureReady(fresh);
        if(!encode(fresh).equals(encode(decodeList(row.get("result_json"))))) throw new BusinessException(409,"资源占用已变化，请重新编排审核，禁止按旧结果下发");
        Map<String,Operation> ops=new HashMap<>();input.operations().forEach(o->ops.put(o.key(),o));
        for(var scheduled:fresh) {
            Operation op=ops.get(String.valueOf(scheduled.get("key")));PlantingPlan p=validateOperation(tenant,farm,op);
            LocalDate day=LocalDate.parse(String.valueOf(scheduled.get("date")));
            Integer duplicate=db.queryForObject("SELECT COUNT(*) FROM agri_prod_calendar_item i JOIN agri_prod_task_info t ON t.id=i.task_id AND t.tenant_id=i.tenant_id WHERE i.tenant_id=? AND i.plan_id=? AND i.stage_id=? AND i.scheduled_date=? AND t.task_name=? AND t.deleted=0 AND t.status NOT IN ('cancelled','canceled','expired')",Integer.class,tenant,p.getId(),op.stageId(),day,op.taskName());
            if(duplicate!=null&&duplicate>0) throw new BusinessException(409,"该阶段当日已有编排任务，请复用原任务，勿重复下发");
            TaskSaveDTO dto=new TaskSaveDTO();dto.setFarmId(String.valueOf(farm));dto.setPlotId(p.getPlotId());dto.setPlanId(p.getId());dto.setStageId(op.stageId());dto.setCropName(p.getCropName());dto.setTaskName(op.taskName());dto.setTaskType(op.taskType());dto.setPriority(String.valueOf(op.priority()));dto.setPlanStartTime(day.atTime(8,0));dto.setPlanEndTime(day.atTime(17,0));dto.setTaskDesc("农事日历编排 "+id+"；依据："+op.standardRef()+"；资源："+op.people()+"人、"+op.machineSlots()+"机具位。执行前须复核即时天气及安全条件。");
            Long taskId=tasks.save(dto,tenant).getId();tasks.assignTask(taskId,String.valueOf(op.memberId()),null,tenant);
            db.update("INSERT INTO agri_prod_calendar_item(arrangement_id,item_key,tenant_id,farm_id,plot_id,plan_id,stage_id,member_id,scheduled_date,people,machine_slots,task_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",id,op.key(),tenant,farm,p.getPlotId(),p.getId(),op.stageId(),op.memberId(),day,op.people(),op.machineSlots(),taskId);
        }
        db.update("UPDATE agri_prod_calendar_arrangement SET input_json=?,status='PUBLISHED',revision=revision+1,updated_at=? WHERE id=? AND tenant_id=?",encode(input),LocalDateTime.now(),id,tenant);event(tenant,id,"PUBLISHED",Map.of("taskCount",fresh.size()));return detail(tenant,id);
    }
    @Transactional
    public Map<String,Object> reschedule(String tenant,String id,int revision,String reason,boolean crossMonthConfirmed,CalendarArrangeRequest input) {
        var row=lock(tenant,id);Long farm=((Number)row.get("farm_id")).longValue();access(tenant,farm,true);expect(row,revision);note(reason);lockFarm(tenant,farm);
        if(!"PUBLISHED".equals(row.get("status"))) fail("仅已下发且未执行的周计划可调整原任务");
        if(!farm.equals(ownedFarm(tenant,input.farmId()))) fail("不能更换农场");
        var old=input(row);var oldOps=new HashMap<String,Operation>();old.operations().forEach(o->oldOps.put(o.key(),o));
        if(input.operations()==null||input.operations().size()!=oldOps.size()) fail("已下发编排不可新增或移除农事，请另建编排");
        for(var op:input.operations()) {
            var prior=oldOps.get(op.key());if(prior==null||!Objects.equals(prior.planId(),op.planId())||!Objects.equals(prior.stageId(),op.stageId())) fail("已下发编排不得更换关联阶段");
        }
        input=weather.refreshInput(tenant,farmEntity(tenant,farm),input);
        var result=compute(tenant,farm,input,id);ensureReady(result);
        var oldDates=new HashMap<String,LocalDate>();for(var item:decodeList(row.get("result_json"))) if(item.get("date")!=null) oldDates.put(String.valueOf(item.get("key")),LocalDate.parse(String.valueOf(item.get("date"))));
        boolean cross=!YearMonth.from(old.weekStart()).equals(YearMonth.from(input.weekStart()));
        for(var item:result) {var prior=oldDates.get(String.valueOf(item.get("key")));if(Boolean.TRUE.equals(item.get("crossMonth"))||prior!=null&&!YearMonth.from(prior).equals(YearMonth.from(LocalDate.parse(String.valueOf(item.get("date")))))) cross=true;}
        if(cross) {if(!crossMonthConfirmed) fail("跨月调整须本农场农技员明确确认");technician(tenant,farm);}
        for(var item:result) {
            String key=String.valueOf(item.get("key"));var op=input.operations().stream().filter(o->o.key().equals(key)).findFirst().orElseThrow();
            var linkage=db.queryForMap("SELECT task_id FROM agri_prod_calendar_item WHERE tenant_id=? AND arrangement_id=? AND item_key=?",tenant,id,key);Long taskId=((Number)linkage.get("task_id")).longValue();
            db.queryForList("SELECT id FROM agri_prod_task_info WHERE id=? AND tenant_id=? FOR UPDATE",taskId,tenant);
            var t=taskMapper.selectById(taskId);if(t==null||!tenant.equals(t.getTenantId())||!farm.equals(t.getFarmId())||!Set.of("pending","assigned","rejected").contains(Objects.toString(t.getStatus(),""))||Integer.valueOf(1).equals(t.getAcceptStatus())) fail("已有任务开始执行、被删除或已验收，无法整体重排");
            LocalDate day=LocalDate.parse(String.valueOf(item.get("date")));TaskSaveDTO dto=new TaskSaveDTO();dto.setId(taskId);dto.setTaskName(op.taskName());dto.setTaskType(op.taskType());dto.setPriority(String.valueOf(op.priority()));dto.setPlanStartTime(day.atTime(8,0));dto.setPlanEndTime(day.atTime(17,0));dto.setTaskDesc("编排调整 "+id+"；依据："+op.standardRef()+"；原因："+reason);
            tasks.update(dto,tenant);tasks.assignTask(taskId,String.valueOf(op.memberId()),null,tenant);
            db.update("UPDATE agri_prod_calendar_item SET member_id=?,scheduled_date=?,people=?,machine_slots=? WHERE tenant_id=? AND arrangement_id=? AND item_key=?",op.memberId(),day,op.people(),op.machineSlots(),tenant,id,key);
        }
        db.update("UPDATE agri_prod_calendar_arrangement SET week_start=?,input_json=?,result_json=?,ai_json=NULL,approved_by=?,cross_month_by=?,revision=revision+1,updated_at=? WHERE tenant_id=? AND id=?",input.weekStart(),encode(input),encode(result),operator(),cross?operator():row.get("cross_month_by"),LocalDateTime.now(),tenant,id);
        event(tenant,id,"RESCHEDULED",Map.of("reason",reason,"crossMonthConfirmed",cross,"beforeInput",decode(row.get("input_json")),"beforeResult",decodeList(row.get("result_json")),"afterInput",input,"afterResult",result));return detail(tenant,id);
    }
    @Transactional
    public Map<String,Object> close(String tenant,String id,int revision,String reason) {
        var row=lock(tenant,id);access(tenant,((Number)row.get("farm_id")).longValue(),true);expect(row,revision);note(reason);
        if(!"PUBLISHED".equals(row.get("status"))) fail("仅已下发编排可结案");
        var linked=linked(tenant,id);if(linked.isEmpty()||linked.stream().anyMatch(t->!accepted(t))) fail("所有关联任务必须验收通过后才能结案；取消/删除/过期不视为完成");
        db.update("UPDATE agri_prod_calendar_arrangement SET status='CLOSED',revision=revision+1,updated_at=? WHERE id=? AND tenant_id=?",LocalDateTime.now(),id,tenant);event(tenant,id,"CLOSED",Map.of("reason",reason));return detail(tenant,id);
    }
    public Map<String,Object> detail(String tenant,String id) {
        var row=one(tenant,id,false);access(tenant,((Number)row.get("farm_id")).longValue(),false);
        Map<String,Object> view=new LinkedHashMap<>();view.put("id",id);view.put("farmId",row.get("farm_id"));view.put("weekStart",row.get("week_start"));view.put("status",row.get("status"));view.put("revision",row.get("revision"));view.put("input",decode(row.get("input_json")));view.put("items",decodeList(row.get("result_json")));view.put("ai",row.get("ai_json")==null?null:decode(row.get("ai_json")));view.put("approvedBy",row.get("approved_by"));view.put("crossMonthBy",row.get("cross_month_by"));
        var linked=linked(tenant,id);view.put("tasks",linked);view.put("acceptedCount",linked.stream().filter(CalendarArrangementService::accepted).count());
        view.put("events",db.queryForList("SELECT event_type type,payload_json payload,operator,created_at createdAt FROM agri_prod_calendar_event WHERE tenant_id=? AND arrangement_id=? ORDER BY id",tenant,id));return view;
    }
    /** 独立解释：只有真实模型响应才展示，失败不伪装成功，不更改排程。 */
    public Map<String,Object> explain(String tenant,String id,int revision) {
        var row=one(tenant,id,false);access(tenant,((Number)row.get("farm_id")).longValue(),true);expect(row,revision);
        Map<String,Object> explanation=new LinkedHashMap<>();
        try {
            var response=ai.invoke(AiInvokeRequest.builder().sceneCode("farm.crop.schedule").bizSystem("farm_prod").bizId(id).requestId(UUID.randomUUID().toString()).input(Map.of("constraintSchedule",decodeList(row.get("result_json")),"verifiedInput",decode(row.get("input_json")),"instruction","仅解释给定约束排程，不新增农事、不修改日期、不产生用药处方。缺失数据明确指出。")).build());
            if(response==null || !response.isOk() || response.getResult()==null || response.getUsage()==null || !"REAL_MODEL".equals(response.getUsage().get("execution_mode")) || Boolean.TRUE.equals(response.getResult().get("_fallback"))) throw new IllegalStateException();
            explanation.put("status","REAL_MODEL");explanation.put("result",response.getResult());explanation.put("traceId",response.getTraceId());explanation.put("usage",response.getUsage());
        } catch(Exception e) { explanation.put("status","UNAVAILABLE");explanation.put("message","真实模型解释暂不可用，保留约束排程；未采用固定演示建议。"); }
        int updated=db.update("UPDATE agri_prod_calendar_arrangement SET ai_json=?,updated_at=? WHERE id=? AND tenant_id=? AND revision=?",encode(explanation),LocalDateTime.now(),id,tenant,revision);
        if(updated!=1) throw new BusinessException(409,"编排已变更，请刷新后重新解释");return detail(tenant,id);
    }
    @Transactional
    public List<Map<String,Object>> interventions(String tenant,String farmId) {
        Long farm=ownedFarm(tenant,farmId);access(tenant,farm,false);
        return scanInterventions(tenant,farm);
    }
    List<Map<String,Object>> scanInterventions(String tenant,Long farm) {
        LocalDate current=LocalDate.now().with(java.time.DayOfWeek.MONDAY);LocalDate previous=current.minusWeeks(1),before=previous.minusWeeks(1);
        var overdue=db.queryForList("SELECT i.plot_id,i.task_id,a.week_start FROM agri_prod_calendar_item i JOIN agri_prod_calendar_arrangement a ON a.id=i.arrangement_id AND a.tenant_id=i.tenant_id LEFT JOIN agri_prod_task_info t ON t.id=i.task_id AND t.tenant_id=i.tenant_id WHERE i.tenant_id=? AND i.farm_id=? AND a.week_start>=? AND a.week_start<? AND (t.id IS NULL OR t.deleted<>0 OR t.accept_status IS NULL OR t.accept_status<>1 OR t.status NOT IN ('completed','done'))",tenant,farm,before,current);
        Map<Long,Set<Integer>> weeks=new HashMap<>();Map<Long,List<Object>> ids=new HashMap<>();
        for(var item:overdue) { Long plot=((Number)item.get("plot_id")).longValue();LocalDate week=LocalDate.parse(item.get("week_start").toString());int bucket=week.isBefore(previous)?0:1;weeks.computeIfAbsent(plot,k->new HashSet<>()).add(bucket);ids.computeIfAbsent(plot,k->new ArrayList<>()).add(item.get("task_id")); }
        weeks.forEach((plot,buckets)->{if(buckets.size()==2) db.update("INSERT IGNORE INTO agri_prod_calendar_intervention(id,tenant_id,farm_id,plot_id,week_start,state,task_ids_json,created_at) VALUES(?,?,?,?,?,'PENDING',?,?)",UUID.randomUUID().toString(),tenant,farm,plot,current,encode(ids.get(plot)),LocalDateTime.now());});
        return db.queryForList("SELECT id,plot_id plotId,week_start weekStart,state,task_ids_json taskIds,note,resolved_by resolvedBy,created_at createdAt FROM agri_prod_calendar_intervention WHERE tenant_id=? AND farm_id=? ORDER BY created_at DESC LIMIT 100",tenant,farm);
    }
    @Transactional
    public void resolveIntervention(String tenant,String id,String reason) {
        note(reason);var rows=db.queryForList("SELECT farm_id FROM agri_prod_calendar_intervention WHERE id=? AND tenant_id=? FOR UPDATE",id,tenant);if(rows.isEmpty()) throw new BusinessException(404,"介入记录不存在");
        technician(tenant,((Number)rows.get(0).get("farm_id")).longValue());db.update("UPDATE agri_prod_calendar_intervention SET state='RESOLVED',note=?,resolved_by=?,resolved_at=? WHERE id=? AND tenant_id=? AND state='PENDING'",reason,operator(),LocalDateTime.now(),id,tenant);
    }
    /** 仅由本域定时任务调用，不经公开接口，系统身份单独留痕。 */
    @Transactional
    public void refreshDraftFromJob(String tenant,String id) {
        var row=lock(tenant,id);
        if(!"DRAFT".equals(row.get("status"))) return;
        var snapshot=input(row);if(snapshot.weekStart().plusDays(6).isBefore(LocalDate.now())) return;
        Long farm=((Number)row.get("farm_id")).longValue(); snapshot=weather.refreshInput(tenant,farmEntity(tenant,farm),snapshot);
        var result=compute(tenant,farm,snapshot);preserveCrossMonth(row,result);
        if(!encode(result).equals(encode(decodeList(row.get("result_json"))))) {
            db.update("UPDATE agri_prod_calendar_arrangement SET input_json=?,result_json=?,ai_json=NULL,revision=revision+1,updated_at=? WHERE tenant_id=? AND id=?",encode(snapshot),encode(result),LocalDateTime.now(),tenant,id);
            db.update("INSERT INTO agri_prod_calendar_event(arrangement_id,tenant_id,event_type,payload_json,operator,created_at) VALUES(?,?, 'DAILY_REPLAN',?,'SYSTEM_CALENDAR',?)",id,tenant,encode(Map.of("reason","每日06:00刷新真实天气预报后重排未审核草稿","before",decodeList(row.get("result_json")),"after",result)),LocalDateTime.now());
        }
    }
    private List<Map<String,Object>> compute(String tenant,Long farm,CalendarArrangeRequest input) {return compute(tenant,farm,input,null);}
    private List<Map<String,Object>> compute(String tenant,Long farm,CalendarArrangeRequest input,String excludedArrangement) {
        if(input.operations()!=null) for(var o:input.operations()) {if(o==null) fail("农事条目不能为空");validateOperation(tenant,farm,o);}
        var result=CalendarSchedulingEngine.arrange(input,occupancy(tenant,farm,input.weekStart(),excludedArrangement),LocalDateTime.now());
        for(var row:result) {
            var op=input.operations().stream().filter(o->o.key().equals(row.get("key"))).findFirst().orElseThrow();
            var p=plans.selectById(op.planId());var stage=stages.selectById(op.stageId());
            row.put("plotId",p.getPlotId());row.put("plotName",p.getPlotName());row.put("cropName",p.getCropName());row.put("variety",p.getCropVariety());row.put("stageName",stage.getStageName());
            row.put("stageStart",stage.getPlanStartDate()==null?null:stage.getPlanStartDate().toString());row.put("stageEnd",stage.getPlanEndDate()==null?null:stage.getPlanEndDate().toString());
        }
        return result;
    }
    private PlantingPlan validateOperation(String tenant,Long farm,Operation op) {
        PlantingPlan p=op.planId()==null?null:plans.selectById(op.planId());PlanStage s=op.stageId()==null?null:stages.selectById(op.stageId());
        if(p==null||!tenant.equals(p.getTenantId())||!farm.equals(p.getFarmId())||p.getPlotId()==null||s==null||!tenant.equals(s.getTenantId())||!p.getId().equals(s.getPlanId())) fail("计划、地块与阶段必须属于当前主体和农场");
        if(Set.of("terminated","completed","cancelled","3","4").contains(Objects.toString(p.getPlanStatus(),"")) || !Set.of(1,2).contains(s.getStatus()==null?1:s.getStatus())) fail("计划或阶段已结束/取消，不可编排");
        if(op.earliest()==null||op.latest()==null||s.getPlanStartDate()==null||s.getPlanEndDate()==null||op.earliest().isBefore(s.getPlanStartDate())||op.latest().isAfter(s.getPlanEndDate())) fail("农事窗口必须在现有阶段日期内，请先核实种植计划");
        Integer plotCount=db.queryForObject("SELECT COUNT(*) FROM agri_prod_plot_info WHERE id=? AND tenant_id=? AND farm_id=? AND deleted=0",Integer.class,p.getPlotId(),tenant,farm);
        if(plotCount==null||plotCount!=1) fail("关联地块已删除或不属于当前农场");
        if(s.getActualStartDate()!=null&&s.getPlanStartDate()!=null&&Math.abs(java.time.temporal.ChronoUnit.DAYS.between(s.getPlanStartDate(),s.getActualStartDate()))>3) fail("阶段实际日期偏差超过3天，请先在种植计划重算并校准阶段窗口");
        TeamMember m=op.memberId()==null?null:members.selectById(op.memberId());if(m==null||!tenant.equals(m.getTenantId())||!String.valueOf(farm).equals(m.getFarmId())||!Integer.valueOf(1).equals(m.getStatus())) fail("责任人必须是本农场在职成员");
        return p;
    }
    private List<CalendarSchedulingEngine.Occupancy> occupancy(String tenant,Long farm,LocalDate start,String excludedArrangement) {
        if(start==null) return List.of();List<CalendarSchedulingEngine.Occupancy> result=new ArrayList<>();
        var existing=taskMapper.selectList(new LambdaQueryWrapper<Task>().eq(Task::getTenantId,tenant).eq(Task::getFarmId,farm).le(Task::getPlanStartTime,start.plusDays(6).atTime(23,59,59)).ge(Task::getPlanEndTime,start.atStartOfDay()));
        for(var t:existing) {
            if(excludedArrangement!=null&&db.queryForObject("SELECT COUNT(*) FROM agri_prod_calendar_item WHERE tenant_id=? AND arrangement_id=? AND task_id=?",Integer.class,tenant,excludedArrangement,t.getId())>0) continue;
            if(Set.of("cancelled","canceled","expired").contains(Objects.toString(t.getStatus(),"")) || Integer.valueOf(1).equals(t.getAcceptStatus())) continue;
            var resource=db.queryForList("SELECT people,machine_slots FROM agri_prod_calendar_item WHERE tenant_id=? AND task_id=?",tenant,t.getId());
            int people=resource.isEmpty()?10000:((Number)resource.get(0).get("people")).intValue();int machines=resource.isEmpty()?1000:((Number)resource.get(0).get("machine_slots")).intValue();
            LocalDate from=t.getPlanStartTime().toLocalDate().isBefore(start)?start:t.getPlanStartTime().toLocalDate(),end=t.getPlanEndTime().toLocalDate().isAfter(start.plusDays(6))?start.plusDays(6):t.getPlanEndTime().toLocalDate();
            for(LocalDate day=from;!day.isAfter(end);day=day.plusDays(1)) result.add(new CalendarSchedulingEngine.Occupancy(day,t.getExecutorId(),people,machines));
        }
        return result;
    }
    private List<Map<String,Object>> linked(String tenant,String id) {
        return db.queryForList("SELECT i.item_key itemKey,i.task_id taskId,i.scheduled_date scheduledDate,t.task_name taskName,t.status,t.accept_status acceptStatus,t.deleted,t.plan_start_time actualScheduledStart,t.plan_end_time actualScheduledEnd FROM agri_prod_calendar_item i LEFT JOIN agri_prod_task_info t ON t.id=i.task_id AND t.tenant_id=i.tenant_id WHERE i.tenant_id=? AND i.arrangement_id=? ORDER BY i.scheduled_date,i.item_key",tenant,id);
    }
    private static boolean accepted(Map<String,Object> t) {return t.get("acceptStatus") instanceof Number n&&n.intValue()==1&&Set.of("completed","done").contains(Objects.toString(t.get("status"),""))&&t.get("deleted") instanceof Number d&&d.intValue()==0;}
    private Long ownedFarm(String tenant,String raw) {if(raw==null||raw.isBlank()) fail("请选择当前农场");Long id=farmIds.resolveFilter(raw,tenant);Farm farm=farms.selectById(id);if(farm==null||!tenant.equals(farm.getTenantId())) throw new BusinessException(404,"农场不存在或不属于当前主体");return id;}
    private Farm farmEntity(String tenant,Long farmId) { Farm farm=farms.selectById(farmId); if(farm==null||!tenant.equals(farm.getTenantId())) throw new BusinessException(404,"农场不存在或不属于当前主体"); return farm; }
    public Map<String,Object> refreshWeather(String tenant,String farmId,LocalDate weekStart) { Long farm=ownedFarm(tenant,farmId); access(tenant,farm,false); return weather.refresh(tenant,farmEntity(tenant,farm),weekStart); }
    public Map<String,Object> latestWeather(String tenant,String farmId,LocalDate weekStart) { Long farm=ownedFarm(tenant,farmId); access(tenant,farm,false); var rows=db.queryForList("SELECT provider,source_url sourceUrl,status,issued_at issuedAt,normalized_json normalizedJson,error_message errorMessage,created_at createdAt FROM agri_prod_calendar_weather_snapshot WHERE tenant_id=? AND farm_id=? AND week_start=? ORDER BY id DESC LIMIT 1",tenant,farm,weekStart); if(rows.isEmpty()) return Map.of("status","NOT_FOUND","weekStart",weekStart); var row=new LinkedHashMap<String,Object>(rows.get(0)); try { row.put("days",json.readValue(String.valueOf(row.remove("normalizedJson")),new TypeReference<List<Map<String,Object>>>(){})); } catch(Exception e) { throw new IllegalStateException(e); } return row; }
    private void access(String tenant,Long farm,boolean write) {
        if("owner".equalsIgnoreCase(TenantContextService.currentMerchantRole())) return;
        var list=members.selectList(new LambdaQueryWrapper<TeamMember>().eq(TeamMember::getTenantId,tenant).eq(TeamMember::getFarmId,String.valueOf(farm)).eq(TeamMember::getUserId,TenantContextService.currentUserId()).eq(TeamMember::getStatus,1));
        if(list.isEmpty() || write&&list.stream().noneMatch(m->manager(m))) throw new BusinessException(403,"当前账号无本农场编排权限");
    }
    private boolean manager(TeamMember m) {return Set.of("OWNER","AGRONOMIST","INSPECTOR").contains(Objects.toString(m.getMemberType(),""))||Set.of("FARM_OWNER","AGRONOMIST","INSPECTOR").contains(Objects.toString(m.getRoleCode(),""));}
    private void technician(String tenant,Long farm) {
        var list=members.selectList(new LambdaQueryWrapper<TeamMember>().eq(TeamMember::getTenantId,tenant).eq(TeamMember::getFarmId,String.valueOf(farm)).eq(TeamMember::getUserId,TenantContextService.currentUserId()).eq(TeamMember::getStatus,1));
        if(list.stream().noneMatch(m->"AGRONOMIST".equals(m.getMemberType())||"AGRONOMIST".equals(m.getRoleCode()))) throw new BusinessException(403,"跨月确认/介入处理须由本农场在职农技员完成");
    }
    private void lockFarm(String tenant,Long farm) {db.queryForList("SELECT id FROM agri_prod_farm_info WHERE tenant_id=? AND id=? FOR UPDATE",tenant,farm);}
    private Map<String,Object> lock(String tenant,String id) {return one(tenant,id,true);}
    private Map<String,Object> one(String tenant,String id,boolean lock) {var rows=db.queryForList("SELECT * FROM agri_prod_calendar_arrangement WHERE id=? AND tenant_id=?"+(lock?" FOR UPDATE":""),id,tenant);if(rows.isEmpty()) throw new BusinessException(404,"编排不存在");return rows.get(0);}
    private CalendarArrangeRequest input(Map<String,Object> row) {try{return json.readValue(String.valueOf(row.get("input_json")),CalendarArrangeRequest.class);}catch(Exception e){throw new IllegalStateException(e);}}
    private void expect(Map<String,Object> row,int rev) {if(((Number)row.get("revision")).intValue()!=rev) throw new BusinessException(409,"编排已被修改，请刷新后重试");}
    private void preserveCrossMonth(Map<String,Object> row,List<Map<String,Object>> fresh) {
        Set<String> required=new HashSet<>();for(var item:decodeList(row.get("result_json"))) if(Boolean.TRUE.equals(item.get("crossMonth"))) required.add(String.valueOf(item.get("key")));
        for(var item:fresh) if(required.contains(String.valueOf(item.get("key")))) item.put("crossMonth",true);
    }
    private void ensureReady(List<Map<String,Object>> rows) {if(rows.isEmpty()||rows.stream().anyMatch(r->!"SCHEDULED".equals(r.get("status")))) fail("存在无法安排的农事，请先解决窗口或资源冲突");}
    private void event(String tenant,String id,String type,Object payload) {db.update("INSERT INTO agri_prod_calendar_event(arrangement_id,tenant_id,event_type,payload_json,operator,created_at) VALUES(?,?,?,?,?,?)",id,tenant,type,encode(payload),operator(),LocalDateTime.now());}
    private String encode(Object o) {try{return json.writeValueAsString(o);}catch(Exception e){throw new IllegalStateException(e);}}
    private Map<String,Object> decode(Object o) {try{return json.readValue(String.valueOf(o),new TypeReference<LinkedHashMap<String,Object>>(){});}catch(Exception e){throw new IllegalStateException(e);}}
    private List<Map<String,Object>> decodeList(Object o) {try{return json.readValue(String.valueOf(o),new TypeReference<List<Map<String,Object>>>(){});}catch(Exception e){throw new IllegalStateException(e);}}
    private String hash(String s) {try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private static String operator() {return TenantContextService.currentOperator();}
    private static void note(String s) {if(s==null||s.isBlank()||s.length()>2000) fail("请填写处理原因/意见（1至2000字）");}
    private static void fail(String s) {throw new BusinessException(400,s);}
}
