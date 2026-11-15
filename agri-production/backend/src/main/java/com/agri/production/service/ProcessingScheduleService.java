package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.integration.ProcessingOrderClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.math.BigDecimal;
import java.util.*;
import static com.agri.production.service.ProcessingScheduleEngine.*;

/** 排产域拥有计划/产能版本/工单与委托；订单、库存、设备和加工事实通过原领域核验。 */
@Service
public class ProcessingScheduleService {
    private final JdbcTemplate db; private final ObjectMapper json; private final ProcessingOrderClient orders;
    private final ProcessingScheduleEngine engine=new ProcessingScheduleEngine();
    public ProcessingScheduleService(JdbcTemplate db,ObjectMapper json,ProcessingOrderClient orders){this.db=db;this.json=json;this.orders=orders;}
    private void lock(String t){db.update("INSERT IGNORE INTO agri_prod_schedule_mutex(tenant_id) VALUES(?)",t);db.queryForObject("SELECT tenant_id FROM agri_prod_schedule_mutex WHERE tenant_id=? FOR UPDATE",String.class,t);}
    public Map<String,Object> config(String t){var rows=db.queryForList("SELECT * FROM agri_prod_schedule_config WHERE tenant_id=?",t);return rows.isEmpty()?Map.of("version",0,"payload",Map.of()):Map.of("version",rows.get(0).get("version"),"payload",read(rows.get(0).get("payload_json")));}
    @Transactional public Map<String,Object> saveConfig(String t,Map<String,Object> payload,String op){
        lock(t); resources(payload); require(!text(payload.get("sourceVersion")).isBlank(),"请填写设备产能与换型标准的核验依据版本");
        int cm=integer(payload.get("categoryMinutes")),gm=integer(payload.get("gradeMinutes")),max=integer(payload.get("maxChanges"));
        require(cm>=0&&cm<=480&&gm>=0&&gm<=480&&max>0&&max<=20,"清洗时间或每日切换次数无效");
        for(var p:db.queryForList("SELECT id FROM agri_prod_schedule_plan WHERE tenant_id=? AND status='PUBLISHED'",t)) {
            require(count("SELECT COUNT(*) FROM agri_prod_schedule_work WHERE tenant_id=? AND plan_id=? AND status IN ('READY','RUNNING')",t,p.get("id"))==0,"有在途计划；请先通过重排并完成/取消在途工单后统一修改产能口径");
        }
        int v=integer(config(t).get("version"))+1;
        db.update("INSERT INTO agri_prod_schedule_config(tenant_id,version,payload_json,updated_by,updated_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE version=VALUES(version),payload_json=VALUES(payload_json),updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)",t,v,write(payload),op,LocalDateTime.now());
        event(t,"CONFIG","CONFIG_UPDATED",Map.of("version",v,"sourceVersion",payload.get("sourceVersion")),op);return config(t);
    }
    public Map<String,Object> sources(String t){return Map.of("orders",orders.list(t),"batches",db.queryForList("SELECT id,batch_no batchNo,crop_name cropName,quantity,unit,status FROM agri_prod_harvest_batch WHERE tenant_id=? AND (deleted IS NULL OR deleted=0) AND status IN (1,2) ORDER BY id DESC LIMIT 200",t));}
    public Map<String,Object> list(String t,int page,int size){size=Math.max(1,Math.min(100,size));page=Math.max(1,page);return Map.of("list",db.queryForList("SELECT id,plan_no planNo,status,config_version configVersion,parent_id parentId,approval_required approvalRequired,lock_until lockUntil,created_at createdAt FROM agri_prod_schedule_plan WHERE tenant_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?",t,size,(page-1)*size),"total",count("SELECT COUNT(*) FROM agri_prod_schedule_plan WHERE tenant_id=?",t));}
    public Map<String,Object> detail(String t,String id){var p=one(t,id,false);var out=new LinkedHashMap<String,Object>();out.put("id",id);out.put("planNo",p.get("plan_no"));out.put("status",p.get("status"));out.put("configVersion",p.get("config_version"));out.put("parentId",p.get("parent_id"));out.put("approvalRequired",integer(p.get("approval_required"))==1);out.put("approvedBy",p.get("approved_by"));out.put("lockUntil",p.get("lock_until"));out.put("input",read(p.get("input_json")));out.put("result",read(p.get("result_json")));out.put("works",db.queryForList("SELECT * FROM agri_prod_schedule_work WHERE tenant_id=? AND plan_id=? ORDER BY setup_start",t,id));out.put("outsource",db.queryForList("SELECT * FROM agri_prod_schedule_outsource WHERE tenant_id=? AND plan_id=?",t,id));out.put("events",db.queryForList("SELECT event_type eventType,payload_json payload,operator,created_at createdAt FROM agri_prod_schedule_event WHERE tenant_id=? AND plan_id=? ORDER BY id",t,id));return out;}
    @Transactional public Map<String,Object> solve(String t,Map<String,Object> request,String op){
        lock(t);var cfg=config(t);int version=integer(cfg.get("version"));require(version>0,"请先由主体负责人核验并保存产能规则");
        Map<String,Object> capacity=map(cfg.get("payload"));
        LocalDateTime start=time(request.get("start"));require(!start.isBefore(LocalDateTime.now().minusMinutes(5))&&start.isBefore(LocalDateTime.now().plusDays(31)),"排程起点须在当前至未来30天内");
        String parent=text(request.get("parentId"));boolean approval=false;
        if(!parent.isBlank()){
            var old=one(t,parent,true);require("PUBLISHED".equals(old.get("status")),"仅已发布计划可重排");require(count("SELECT COUNT(*) FROM agri_prod_schedule_work WHERE tenant_id=? AND plan_id=? AND status IN ('RUNNING','DONE')",t,parent)==0&&count("SELECT COUNT(*) FROM agri_prod_schedule_outsource WHERE tenant_id=? AND plan_id=?",t,parent)==0,"已执行或已委托外协的计划不可整体重排，请另建剩余量计划");require(!text(request.get("reason")).isBlank(),"重排必须填写原因");
            require(count("SELECT COUNT(*) FROM agri_prod_schedule_plan WHERE tenant_id=? AND parent_id=? AND status IN ('DRAFT','APPROVED')",t,parent)==0,"已有待发布重排方案，请先处理");
            approval=count("SELECT COUNT(*) FROM agri_prod_schedule_work WHERE tenant_id=? AND plan_id=? AND status='READY' AND setup_start<?",t,parent,LocalDateTime.now().plusHours(24))>0;
        }
        var jobs=jobs(t,request,parent,true);if(!parent.isBlank()){var oldInput=read(one(t,parent,false).get("input_json"));Map<String,Double> before=new HashMap<>(),after=new HashMap<>();for(var j:rows(oldInput.get("jobs")))before.merge(text(j.get("orderId"))+":"+text(j.get("itemId")),dbl(j.get("kg")),Double::sum);for(Job j:jobs)after.merge(j.orderId()+":"+j.itemId(),j.kg(),Double::sum);before.forEach((k,v)->require(Math.abs(after.getOrDefault(k,0d)-v)<0.001,"重排必须保留原计划订单总量，可拆批但不可漏单"));}var occupied=occupied(t,parent);
        var result=engine.solve(jobs,resources(capacity),occupied,start,integer(capacity.get("categoryMinutes")),integer(capacity.get("gradeMinutes")),integer(capacity.get("maxChanges")));
        var input=new LinkedHashMap<>(request);input.put("jobs",jobs);input.put("capacity",capacity);input.put("dataCutoff",LocalDateTime.now());
        Map<String,Object> resultMap=new LinkedHashMap<>();resultMap.put("slots",result.slots());resultMap.put("conflicts",result.conflicts());resultMap.put("loads",result.loads());resultMap.put("decisions",new LinkedHashMap<>());
        String id=UUID.randomUUID().toString();String no="SCH-"+LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"))+"-"+id.substring(0,6);
        db.update("INSERT INTO agri_prod_schedule_plan(id,tenant_id,plan_no,config_version,parent_id,status,input_json,result_json,approval_required,reason,created_by,created_at,updated_at) VALUES(?,?,?,?,?,'DRAFT',?,?,?,?,?,?,?)",id,t,no,version,parent.isBlank()?null:parent,write(input),write(resultMap),approval?1:0,text(request.get("reason")),op,LocalDateTime.now(),LocalDateTime.now());
        event(t,id,"SOLVED",Map.of("jobs",jobs.size(),"conflicts",result.conflicts().size(),"approvalRequired",approval),op);return detail(t,id);
    }
    @Transactional public Map<String,Object> decide(String t,String id,Map<String,Object> req,String op){
        lock(t);var p=one(t,id,true);require("DRAFT".equals(p.get("status")),"仅草稿可选择冲突方案");var result=read(p.get("result_json"));String key=text(req.get("jobKey")),type=text(req.get("type"));
        require(rows(result.get("conflicts")).stream().anyMatch(c->key.equals(text(c.get("jobKey")))),"不存在此冲突任务");require(List.of("POSTPONE","OUTSOURCE").contains(type),"拆批请按原订单明细拆分数量后重新生成计划");require(!text(req.get("reason")).isBlank(),"请填写选择原因");
        var job=rows(read(p.get("input_json")).get("jobs")).stream().filter(j->key.equals(text(j.get("key")))).findFirst().orElseThrow();
        var decision=new LinkedHashMap<>(req);
        if(type.equals("POSTPONE")){
            require(rows(result.get("slots")).stream().anyMatch(s->key.equals(text(s.get("jobKey")))),"未排入任务不可仅顺延，须补充产能或外协");
            require(bool(req.get("customerConfirmed"))&&!text(req.get("customerEvidence")).isBlank(),"顺延须销售登记客户同意凭证");
            number(req.get("cost"),0,1e9,"顺延成本");
        } else {
            Map<String,Object> provider=rows(map(read(p.get("input_json")).get("capacity")).get("providers")).stream().filter(x->text(req.get("providerId")).equals(text(x.get("id")))).findFirst().orElseThrow(()->new BusinessException(400,"请选择已维护的外协厂商"));
            require(!text(provider.get("qualification" )).isBlank()&&!text(provider.get("traceEvidence")).isBlank()&&bool(provider.get("traceable")),"外协须有有效资质和在制品追溯证据");
            require(!LocalDate.parse(text(provider.get("validUntil"))).isBefore(time(job.get("due")).toLocalDate()),"外协资质未覆盖交期");
            require(strings(provider.get("categories")).contains(text(job.get("category"))),"外协资质不覆盖本品类");
            double kg=dbl(job.get("kg"));require(kg<=number(provider.get("capacityKg"),0.001,1e9,"外协能力"),"超出外协核验能力");
            double reserved=0;for(var existing:map(result.get("decisions")).entrySet()){if(existing.getKey().equals(key))continue;var d=map(existing.getValue());if("OUTSOURCE".equals(d.get("type"))&&text(provider.get("id")).equals(text(map(d.get("provider")).get("id")))){var oldJob=rows(read(p.get("input_json")).get("jobs")).stream().filter(x->existing.getKey().equals(text(x.get("key")))).findFirst().orElseThrow();reserved+=dbl(oldJob.get("kg"));}}require(kg+reserved<=dbl(provider.get("capacityKg")),"本计划外协累计数量超出核验能力");
            double cost=kg*number(provider.get("pricePerKg"),0.001,1e6,"外协单价");decision.put("provider",provider);decision.put("cost",BigDecimal.valueOf(cost).setScale(2,java.math.RoundingMode.HALF_UP));
        }
        Map<String,Object> decisions=map(result.get("decisions"));decisions.put(key,decision);result.put("decisions",decisions);
        db.update("UPDATE agri_prod_schedule_plan SET result_json=?,updated_at=? WHERE tenant_id=? AND id=?",write(result),LocalDateTime.now(),t,id);event(t,id,"CONFLICT_DECIDED",decision,op);return detail(t,id);
    }
    @Transactional public Map<String,Object> approve(String t,String id,String reason,String op){lock(t);var p=one(t,id,true);require("DRAFT".equals(p.get("status")),"仅草稿可审批");require(!reason.isBlank(),"审批意见不能为空");db.update("UPDATE agri_prod_schedule_plan SET status='APPROVED',approved_by=?,approved_at=?,updated_at=? WHERE tenant_id=? AND id=?",op,LocalDateTime.now(),LocalDateTime.now(),t,id);event(t,id,"OWNER_APPROVED",Map.of("reason",reason),op);return detail(t,id);}
    @Transactional public Map<String,Object> publish(String t,String id,String op){
        lock(t);var p=one(t,id,true);if("PUBLISHED".equals(p.get("status")))return detail(t,id);
        require("APPROVED".equals(p.get("status")),"须由厂长（当前主体所有者）审批后发布");require(integer(p.get("config_version"))==integer(config(t).get("version")),"产能版本已变化，请重新计算全部计划");
        Map<String,Object> input=read(p.get("input_json")),result=read(p.get("result_json"));String parent=text(p.get("parent_id"));
        if(!parent.isBlank()){require("PUBLISHED".equals(one(t,parent,true).get("status")),"原计划已变化，请重新计算");require(count("SELECT COUNT(*) FROM agri_prod_schedule_work WHERE tenant_id=? AND plan_id=? AND status IN ('RUNNING','DONE')",t,parent)==0&&count("SELECT COUNT(*) FROM agri_prod_schedule_outsource WHERE tenant_id=? AND plan_id=?",t,parent)==0,"原计划已执行，不可替换");}
        var currentJobs=jobs(t,input,parent,true);Map<String,Object> decisions=map(result.get("decisions"));
        for(var c:rows(result.get("conflicts")))require(decisions.containsKey(text(c.get("jobKey"))),"请先处理全部交期/未排入冲突");
        Map<String,Double> providerAmounts=new HashMap<>();
        for(var entry:decisions.entrySet()) {var d=map(entry.getValue());if(!"OUTSOURCE".equals(d.get("type")))continue;var provider=map(d.get("provider"));String providerId=text(provider.get("id"));
            require(!text(provider.get("qualification")).isBlank()&&!text(provider.get("traceEvidence")).isBlank()&&bool(provider.get("traceable")),"外协资质/追溯不完整");
            Job job=currentJobs.stream().filter(j->j.key().equals(entry.getKey())).findFirst().orElseThrow();
            require(!LocalDate.parse(text(provider.get("validUntil"))).isBefore(LocalDate.now())&&!LocalDate.parse(text(provider.get("validUntil"))).isBefore(job.due().toLocalDate()),"外协资质已失效");
            double pending=Optional.ofNullable(db.queryForObject("SELECT COALESCE(SUM(quantity_kg),0) FROM agri_prod_schedule_outsource WHERE tenant_id=? AND status='COMMISSIONED' AND JSON_UNQUOTE(JSON_EXTRACT(provider_json,'$.provider.id'))=?",Double.class,t,providerId)).orElse(0d);
            providerAmounts.merge(providerId,job.kg(),Double::sum);require(pending+providerAmounts.get(providerId)<=dbl(provider.get("capacityKg")),"外协厂商被其他计划占用，剩余能力不足");
        }
        var busy=occupied(t,parent);
        for(var s:rows(result.get("slots"))) {
            if("OUTSOURCE".equals(map(decisions.get(text(s.get("jobKey")))).get("type")))continue;
            require(!time(s.get("setupStart")).isBefore(LocalDateTime.now().minusMinutes(1)),"排程已过时，请重算");
            for(Slot b:busy)require(!b.resourceId().equals(text(s.get("resourceId")))||!time(s.get("setupStart")).isBefore(b.end())||!time(s.get("end")).isAfter(b.setupStart()),"设备被其他计划占用，请重算");
        }
        // 审批之后新进入24小时锁定范围的变更也需再次审批。
        if(!parent.isBlank()){
            LocalDateTime approval=sqlTime(p.get("approved_at"));
            require(count("SELECT COUNT(*) FROM agri_prod_schedule_work WHERE tenant_id=? AND plan_id=? AND status='READY' AND setup_start>=? AND setup_start<?",t,parent,approval.plusHours(24),LocalDateTime.now().plusHours(24))==0,"审批后又有工单进入锁定窗口，请撤销草稿并重新审批重排");
            db.update("UPDATE agri_prod_schedule_work SET status='SUPERSEDED',updated_at=? WHERE tenant_id=? AND plan_id=? AND status='READY'",LocalDateTime.now(),t,parent);
            db.update("UPDATE agri_prod_schedule_plan SET status='SUPERSEDED',updated_at=? WHERE tenant_id=? AND id=?",LocalDateTime.now(),t,parent);
        }
        Map<String,Job> byKey=new HashMap<>();currentJobs.forEach(j->byKey.put(j.key(),j));
        for(var s:rows(result.get("slots"))) {
            String key=text(s.get("jobKey"));if("OUTSOURCE".equals(map(decisions.get(key)).get("type")))continue;Job j=byKey.get(key);require(j!=null,"订单任务快照不一致");
            db.update("INSERT INTO agri_prod_schedule_work(id,tenant_id,plan_id,job_key,order_id,item_id,batch_id,resource_id,operation,quantity_kg,setup_start,starts_at,ends_at,setup_minutes,status,snapshot_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'READY',?,?)",UUID.randomUUID().toString(),t,id,key,j.orderId(),j.itemId(),j.batchId(),s.get("resourceId"),s.get("operation"),j.kg(),time(s.get("setupStart")),time(s.get("start")),time(s.get("end")),integer(s.get("setupMinutes")),write(s),LocalDateTime.now());
        }
        for(Job j:currentJobs){var d=map(decisions.get(j.key()));if(!"OUTSOURCE".equals(d.get("type")))continue;
            db.update("INSERT INTO agri_prod_schedule_outsource(id,tenant_id,plan_id,job_key,order_id,item_id,batch_id,provider_json,quantity_kg,cost,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'COMMISSIONED',?)",UUID.randomUUID().toString(),t,id,j.key(),j.orderId(),j.itemId(),j.batchId(),write(d),j.kg(),d.get("cost"),LocalDateTime.now());
        }
        db.update("UPDATE agri_prod_schedule_plan SET status='PUBLISHED',lock_until=?,updated_at=? WHERE tenant_id=? AND id=?",LocalDateTime.now().plusHours(24),LocalDateTime.now(),t,id);event(t,id,"PUBLISHED",Map.of("parentId",parent,"customerNotification","未自动通知客户；承诺变更由销售确认"),op);return detail(t,id);
    }
    @Transactional public Map<String,Object> work(String t,String id,String workId,Map<String,Object> req,String op){
        lock(t);require("PUBLISHED".equals(one(t,id,true).get("status")),"仅已发布计划可执行工单");var rows=db.queryForList("SELECT * FROM agri_prod_schedule_work WHERE tenant_id=? AND plan_id=? AND id=? FOR UPDATE",t,id,workId);require(rows.size()==1,"工单不存在");var w=rows.get(0);String action=text(req.get("action"));
        Map<String,Object> planInput=read(one(t,id,false).get("input_json"));
        var job=rows(planInput.get("jobs")).stream().filter(j->text(w.get("job_key")).equals(text(j.get("key")))).findFirst().orElseThrow();
        List<String> route=strings(job.get("route"));int step=route.indexOf(text(w.get("operation")));
        for(int i=0;i<step;i++)require(count("SELECT COUNT(*) FROM agri_prod_schedule_work WHERE tenant_id=? AND plan_id=? AND job_key=? AND operation=? AND status='DONE'",t,id,w.get("job_key"),route.get(i))==1,"前置工序未完成");
        require(List.of("READY","RUNNING").contains(text(w.get("status"))),"此工单已结束，不能重复操作");
        if("START".equals(action)){var liveOrder=orders.detail(t,text(w.get("order_id")));require(List.of("pending_confirm","pending","paid").contains(text(liveOrder.get("status"))),"订单已取消或结束，不可开工");require("READY".equals(w.get("status")),"工单已开工");require(bool(req.get("arrivalConfirmed"))&&!text(req.get("arrivalEvidence")).isBlank(),"开工须登记原料实际到厂凭证");require(count("SELECT COUNT(*) FROM agri_prod_schedule_work WHERE tenant_id=? AND resource_id=? AND status='RUNNING'",t,w.get("resource_id"))==0,"设备仍有进行中工单");require(!sqlTime(w.get("starts_at")).isAfter(LocalDateTime.now()),"尚未到计划开工时间，提前开工须先重排审批");db.update("UPDATE agri_prod_schedule_work SET status='RUNNING',updated_at=? WHERE id=?",LocalDateTime.now(),workId);}
        else if("COMPLETE".equals(action)){
            require("RUNNING".equals(w.get("status")),"请先核验到厂并开工");
            require(text(req.get("processRecordId")).matches("[0-9]+"),"请选择有效原加工记录ID");long record=Long.parseLong(text(req.get("processRecordId")));var facts=db.queryForList("SELECT * FROM agri_prod_process_record WHERE tenant_id=? AND id=? AND (deleted IS NULL OR deleted=0)",t,record);require(facts.size()==1,"加工记录不存在或无权访问");var f=facts.get(0);
            require("DONE".equals(text(f.get("status")))&&text(w.get("batch_id")).equals(text(f.get("batch_id")))&&text(w.get("operation")).equals(text(f.get("process_type"))),"需引用同批次、同工序、已完成的原加工记录");
            require(f.get("started_at")!=null&&f.get("finished_at")!=null&&!sqlTime(f.get("finished_at")).isAfter(LocalDateTime.now()),"加工记录须包含真实已发生起止时间");
            require(kg(f.get("input_quantity"),f.get("input_unit"))+0.001>=dbl(w.get("quantity_kg")),"加工记录投入量不足以覆盖工单");
            require(count("SELECT COUNT(*) FROM agri_prod_schedule_work WHERE tenant_id=? AND process_record_id=?",t,record)==0,"加工记录已被其他工单使用");
            db.update("UPDATE agri_prod_schedule_work SET status='DONE',process_record_id=?,updated_at=? WHERE id=?",record,LocalDateTime.now(),workId);
        }else throw new BusinessException(400,"无效工单动作");
        event(t,id,"WORK_"+action,Map.of("workId",workId,"detail",req),op);return detail(t,id);
    }
    @Transactional public Map<String,Object> receipt(String t,String id,String oid,Map<String,Object> req,String op){lock(t);one(t,id,true);require(!text(req.get("traceCode")).isBlank()&&!text(req.get("acceptanceEvidence")).isBlank(),"需外协追溯码及验收凭证");require(db.update("UPDATE agri_prod_schedule_outsource SET status='ACCEPTED',receipt_json=?,updated_at=? WHERE tenant_id=? AND plan_id=? AND id=? AND status='COMMISSIONED'",write(req),LocalDateTime.now(),t,id,oid)==1,"外协委托不存在或已验收");event(t,id,"OUTSOURCE_ACCEPTED",req,op);return detail(t,id);}
    @Transactional public Map<String,Object> close(String t,String id,String op){lock(t);var p=one(t,id,true);require("PUBLISHED".equals(p.get("status")),"仅发布计划可结案");require(count("SELECT COUNT(*) FROM agri_prod_schedule_work WHERE tenant_id=? AND plan_id=? AND status NOT IN ('DONE','SUPERSEDED')",t,id)==0&&count("SELECT COUNT(*) FROM agri_prod_schedule_outsource WHERE tenant_id=? AND plan_id=? AND status<>'ACCEPTED'",t,id)==0,"工单及外协尚未全部验收");require(count("SELECT COUNT(*) FROM agri_prod_schedule_work WHERE tenant_id=? AND plan_id=?",t,id)+count("SELECT COUNT(*) FROM agri_prod_schedule_outsource WHERE tenant_id=? AND plan_id=?",t,id)>0,"空计划不能结案");db.update("UPDATE agri_prod_schedule_plan SET status='COMPLETED',updated_at=? WHERE tenant_id=? AND id=?",LocalDateTime.now(),t,id);event(t,id,"CLOSED",Map.of(),op);return detail(t,id);}
    @Transactional public Map<String,Object> cancel(String t,String id,String reason,String op){lock(t);var p=one(t,id,true);require(!reason.isBlank(),"取消原因不能为空");require(List.of("DRAFT","APPROVED","PUBLISHED").contains(text(p.get("status"))),"计划不能取消");require(count("SELECT COUNT(*) FROM agri_prod_schedule_work WHERE tenant_id=? AND plan_id=? AND status IN ('RUNNING','DONE')",t,id)==0&&count("SELECT COUNT(*) FROM agri_prod_schedule_outsource WHERE tenant_id=? AND plan_id=?",t,id)==0,"已有执行或外协委托，不可直接取消");db.update("UPDATE agri_prod_schedule_work SET status='CANCELED',updated_at=? WHERE tenant_id=? AND plan_id=?",LocalDateTime.now(),t,id);db.update("UPDATE agri_prod_schedule_plan SET status='CANCELED',updated_at=? WHERE tenant_id=? AND id=?",LocalDateTime.now(),t,id);event(t,id,"CANCELED",Map.of("reason",reason),op);return detail(t,id);}
    private List<Resource> resources(Map<String,Object> cfg){List<Resource> result=new ArrayList<>();Set<String> ids=new HashSet<>();for(var r:rows(cfg.get("resources"))){String id=text(r.get("id")),operation=text(r.get("operation"));require(!id.isBlank()&&ids.add(id)&&OPERATIONS.contains(operation),"设备编号重复或工序无效；同一物理设备只能配置一个资源");require(!text(r.get("sourceEvidence")).isBlank(),"设备产能须填写核验依据");List<Block> blocks=new ArrayList<>();for(var b:rows(r.get("downtime"))){var a=time(b.get("start"));var end=time(b.get("end"));require(end.isAfter(a),"检修起止时间无效");blocks.add(new Block(a,end));}result.add(new Resource(id,text(r.get("name")),operation,number(r.get("kgPerHour"),0.001,1e7,"理论产能"),number(r.get("availability"),0.01,1,"可用率"),time(r.get("availableFrom")),blocks));}require(!result.isEmpty()&&result.size()<=60,"请配置1至60个设备工序资源");return result;}
    private List<Job> jobs(String t,Map<String,Object> req,String parent,boolean check){
        List<Job> result=new ArrayList<>();Map<String,Map<String,Object>> cache=new HashMap<>();Set<String> keys=new HashSet<>();Map<String,Double> totals=new HashMap<>();Map<Long,Double> batchTotals=new HashMap<>();
        for(var j:rows(req.get("jobs"))){String key=text(j.get("key")),orderId=text(j.get("orderId")),itemId=text(j.get("itemId"));require(key.matches("[A-Za-z0-9_-]{1,70}")&&keys.add(key),"拆批任务编号为空或重复");
            var order=cache.computeIfAbsent(orderId,k->orders.detail(t,k));require(List.of("pending_confirm","pending","paid").contains(text(order.get("status"))),"订单状态不允许排产，请核对交易订单");
            var item=rows(order.get("items")).stream().filter(i->itemId.equals(text(i.get("id")))).findFirst().orElseThrow(()->new BusinessException(400,"订单明细不存在"));
            double amount=number(j.get("kg"),0.001,1e8,"需求数量kg");LocalDateTime due=time(order.get("deliveryDeadline"));
            if(j.containsKey("due"))require(time(j.get("due")).equals(due),"订单交期已变化，请重新选取订单");
            require(text(j.get("batchId")).matches("[0-9]+"),"请选有效原料批次");long batchId=Long.parseLong(text(j.get("batchId")));var batches=db.queryForList("SELECT * FROM agri_prod_harvest_batch WHERE tenant_id=? AND id=? AND (deleted IS NULL OR deleted=0) AND status IN (1,2)",t,batchId);require(batches.size()==1,"原料批次无效、冻结或不属于当前主体");
            var route=strings(j.get("route"));require(!route.isEmpty()&&route.size()<=9&&new HashSet<>(route).size()==route.size()&&OPERATIONS.containsAll(route),"工艺路线无效或重复");
            String category=text(item.get("category"));if(category.isBlank())category=text(item.get("productName"));
            result.add(new Job(key,orderId,itemId,text(order.get("orderNo")),category,text(item.get("grade")),batchId,amount,time(j.get("arrival")),due,route,integer(j.getOrDefault("priority",0))));
            String token=orderId+":"+itemId;totals.merge(token,amount,Double::sum);batchTotals.merge(batchId,amount,Double::sum);
            double already=allocated(t,orderId,itemId,parent);
            require(totals.get(token)+already<=kg(item.get("quantity"),item.get("unit"))+0.001,"订单明细累计排产数量超出订单剩余量");
            double batchAlready=Optional.ofNullable(db.queryForObject("SELECT COALESCE(SUM(q),0) FROM (SELECT MAX(w.quantity_kg) q FROM agri_prod_schedule_work w JOIN agri_prod_schedule_plan p ON p.id=w.plan_id WHERE w.tenant_id=? AND w.batch_id=? AND w.status NOT IN ('CANCELED','SUPERSEDED') AND NOT (w.plan_id=? AND w.status='READY') GROUP BY w.plan_id,w.job_key) z",Double.class,t,batchId,parent)).orElse(0d);
            batchAlready+=db.queryForObject("SELECT COALESCE(SUM(quantity_kg),0) FROM agri_prod_schedule_outsource WHERE tenant_id=? AND batch_id=?",Double.class,t,batchId);
            require(batchTotals.get(batchId)+batchAlready<=kg(batches.get(0).get("quantity"),batches.get(0).get("unit"))+0.001,"原料批次累计排产超过登记数量");
        }
        require(!result.isEmpty()&&result.size()<=100,"请提供1至100条拆批需求");return result;
    }
    private double allocated(String t,String order,String item,String parent){return Optional.ofNullable(db.queryForObject("SELECT COALESCE(SUM(q),0) FROM (SELECT MAX(w.quantity_kg) q FROM agri_prod_schedule_work w WHERE w.tenant_id=? AND w.order_id=? AND w.item_id=? AND w.status NOT IN ('CANCELED','SUPERSEDED') AND NOT (w.plan_id=? AND w.status='READY') GROUP BY w.plan_id,w.job_key) z",Double.class,t,order,item,parent)).orElse(0d)+db.queryForObject("SELECT COALESCE(SUM(quantity_kg),0) FROM agri_prod_schedule_outsource WHERE tenant_id=? AND order_id=? AND item_id=? AND status IN ('COMMISSIONED','ACCEPTED')",Double.class,t,order,item);}
    private List<Slot> occupied(String t,String parent){List<Slot> out=new ArrayList<>();for(var w:db.queryForList("SELECT * FROM agri_prod_schedule_work WHERE tenant_id=? AND status IN ('READY','RUNNING','DONE') AND NOT(plan_id=? AND status='READY')",t,parent)){var s=read(w.get("snapshot_json"));out.add(new Slot(text(w.get("job_key")),text(w.get("resource_id")),text(w.get("operation")),sqlTime(w.get("setup_start")),sqlTime(w.get("starts_at")),sqlTime(w.get("ends_at")),dbl(w.get("quantity_kg")),integer(w.get("setup_minutes")),false,text(s.get("category")),text(s.get("grade"))));}return out;}
    private Map<String,Object> one(String t,String id,boolean lock){var r=db.queryForList("SELECT * FROM agri_prod_schedule_plan WHERE tenant_id=? AND id=?"+(lock?" FOR UPDATE":""),t,id);if(r.isEmpty())throw new BusinessException(404,"排产计划不存在或无权访问");return r.get(0);}
    private void event(String t,String id,String type,Object data,String op){db.update("INSERT INTO agri_prod_schedule_event(tenant_id,plan_id,event_type,payload_json,operator,created_at) VALUES(?,?,?,?,?,?)",t,id,type,write(data),op,LocalDateTime.now());}
    private long count(String sql,Object...args){return Objects.requireNonNull(db.queryForObject(sql,Long.class,args));}
    private String write(Object v){try{return json.writeValueAsString(v);}catch(Exception e){throw new BusinessException(400,"排产数据格式无效");}}
    private Map<String,Object> read(Object v){try{return json.readValue(String.valueOf(v),new TypeReference<LinkedHashMap<String,Object>>(){});}catch(Exception e){throw new BusinessException(500,"排产历史快照读取失败");}}
    @SuppressWarnings("unchecked") static Map<String,Object> map(Object v){return v instanceof Map?(Map<String,Object>)v:new LinkedHashMap<>();}
    @SuppressWarnings("unchecked") static List<Map<String,Object>> rows(Object v){return v instanceof List?(List<Map<String,Object>>)v:List.of();}
    static List<String> strings(Object v){return v instanceof List<?> l?l.stream().map(String::valueOf).toList():List.of();}
    static String text(Object v){return v==null?"":v.toString().trim();}static boolean bool(Object v){return Boolean.parseBoolean(text(v));}
    static double dbl(Object v){try{return Double.parseDouble(text(v));}catch(Exception e){throw new BusinessException(400,"数值无效");}}
    static int integer(Object v){return v==null?0:(int)dbl(v);}static double number(Object v,double min,double max,String name){double n=dbl(v);require(Double.isFinite(n)&&n>=min&&n<=max,name+"超出范围");return n;}
    static LocalDateTime time(Object v){try{String s=text(v).replace(' ','T');if(s.endsWith("Z")||s.matches(".*[+-][0-9]{2}:[0-9]{2}$"))return OffsetDateTime.parse(s).atZoneSameInstant(ZoneId.of("Asia/Shanghai")).toLocalDateTime();return LocalDateTime.parse(s);}catch(Exception e){throw new BusinessException(400,"请提供准确的日期时间："+text(v));}}
    static LocalDateTime sqlTime(Object v){return v instanceof java.sql.Timestamp ts?ts.toLocalDateTime():v instanceof LocalDateTime dt?dt:time(v);}
    static double kg(Object quantity,Object unit){double n=number(quantity,0.001,1e12,"重量");return switch(text(unit).toLowerCase()){case "kg","千克","公斤"->n;case "吨","t"->n*1000;case "斤"->n*0.5;case "g","克"->n/1000;default->throw new BusinessException(400,"计量单位不能转换为kg，请先核验订单/批次单位");};}
    static void require(boolean ok,String message){if(!ok)throw new BusinessException(400,message);}
}
