package com.agri.production.service;

import com.agri.common.ai.client.AgriAiClient;
import com.agri.common.ai.dto.AiInvokeRequest;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.dto.PestDiagnosisRequest;
import com.agri.production.dto.TaskSaveDTO;
import com.agri.production.entity.Plot;
import com.agri.production.mapper.PlotMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.dao.DuplicateKeyException;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.*;

/** 病例属于生产域；中台仅推理，执行/验收复用任务域，外部专家服务不在此维护。 */
@Service
public class PestDiagnosisService {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final AgriAiClient ai;
    private final PlotIdResolver plotIds;
    private final PlotMapper plots;
    private final FarmIdResolver farms;
    private final ITaskService tasks;
    private final PestImageService pestImages;
    private final TransactionTemplate tx;
    @org.springframework.beans.factory.annotation.Autowired private PestAtlasService atlas;
    public PestDiagnosisService(JdbcTemplate db,ObjectMapper json,AgriAiClient ai,PlotIdResolver plotIds,
            PlotMapper plots,FarmIdResolver farms,ITaskService tasks,PestImageService pestImages,PlatformTransactionManager manager) {
        this.db=db; this.json=json; this.ai=ai; this.plotIds=plotIds; this.plots=plots; this.farms=farms; this.tasks=tasks; this.pestImages=pestImages;
        this.tx=new TransactionTemplate(manager);
    }
    public Map<String,Object> searchKnowledge(String crop,String symptoms,String stage) { return atlas.retrieve(crop,symptoms,stage); }
    public Map<String,Object> create(PestDiagnosisRequest request,String tenant) {
        validateImages(request.getImages());
        Long plotId=plotIds.require(request.getPlotId(),tenant);
        Plot plot=plots.selectById(plotId);
        if(plot==null || !tenant.equals(plot.getTenantId()) || plot.getFarmId()==null)
            throw new BusinessException(404,"地块不存在或不属于当前主体");
        String id=UUID.randomUUID().toString(),attempt=UUID.randomUUID().toString();
        Map<String,Object> input=json.convertValue(request,new TypeReference<Map<String,Object>>(){});
        input.put("plotId",String.valueOf(plotId));
        // 请求指纹只使用用户输入，服务端档案变化不破坏重放幂等。
        String hash=sha256(encode(input));
        input.put("plotContext",Map.of("currentCrop",Objects.toString(plot.getCurrentCrop(),""),
            "variety",Objects.toString(plot.getCropVariety(),""),"plantingDate",Objects.toString(plot.getPlantingDate(),""),
            "expectedHarvestDate",Objects.toString(plot.getExpectedHarvestDate(),""),"soilType",Objects.toString(plot.getSoilType(),"")));
        String encoded=encode(input);
        try {
            db.update("INSERT INTO agri_prod_pest_case(id,tenant_id,farm_id,plot_id,plot_name,crop_name,request_id,request_hash,status,attempt_id,input_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                id,tenant,plot.getFarmId(),plotId,Objects.toString(plot.getPlotName(),"未命名地块"),request.getCropName().trim(),request.getRequestId(),hash,"RUNNING",attempt,encoded,TenantContextService.currentOperator(),LocalDateTime.now(),LocalDateTime.now());
        } catch(DuplicateKeyException e) {
            var existing=db.queryForMap("SELECT id,request_hash FROM agri_prod_pest_case WHERE tenant_id=? AND request_id=?",tenant,request.getRequestId());
            if(!hash.equals(existing.get("request_hash"))) throw new BusinessException(409,"同一请求标识的内容发生变化，请重新发起");
            return detail(String.valueOf(existing.get("id")),tenant,false);
        }
        infer(id,tenant,attempt,input);
        return detail(id,tenant,false);
    }
    public Map<String,Object> retry(String id,String tenant) {
        String attempt=UUID.randomUUID().toString();
        Map<String,Object> input=tx.execute(s -> {
            var row=detail(id,tenant,true);
            String state=String.valueOf(row.get("status"));
            if(!"FAILED".equals(state) && !("RUNNING".equals(state) && LocalDateTime.parse(String.valueOf(row.get("updatedAt"))).isBefore(LocalDateTime.now().minusMinutes(2))))
                throw new BusinessException(409,"仅失败或超时病例可以重试");
            db.update("UPDATE agri_prod_pest_case SET status='RUNNING',attempt_id=?,failure_message=NULL,updated_at=? WHERE id=? AND tenant_id=?",attempt,LocalDateTime.now(),id,tenant);
            return cast(row.get("input"));
        });
        infer(id,tenant,attempt,input);
        return detail(id,tenant,false);
    }
    private void infer(String id,String tenant,String attempt,Map<String,Object> input) {
        try {
            // 覆盖可能过期的客户端字段；每次尝试都有独立的、不可变的知识证据快照。
            Map<String,Object> knowledge=atlas.retrieve(Objects.toString(input.get("cropName"),""),
                Objects.toString(input.get("symptoms"),"")+" "+Objects.toString(input.get("voiceTranscript"),""),Objects.toString(input.get("growthStage"),""));
            Map<String,Object> imageSearch=pestImages.search(Objects.toString(input.get("cropName"),""), strings(input.get("images")));
            input=new LinkedHashMap<>(input); input.put("knowledgeContext",knowledge); input.put("imageSearchContext",imageSearch);
            db.update("INSERT INTO agri_prod_pest_knowledge_snapshot(case_id,attempt_id,tenant_id,snapshot_json,created_at) VALUES(?,?,?,?,?)",id,attempt,tenant,encode(knowledge),LocalDateTime.now());
            db.update("INSERT INTO agri_prod_pest_image_snapshot(case_id,attempt_id,tenant_id,snapshot_json,created_at) VALUES(?,?,?,?,?)",id,attempt,tenant,encode(imageSearch),LocalDateTime.now());
            var response=ai.invoke(AiInvokeRequest.builder().sceneCode("farm.pest.diagnosis").bizSystem("farm_prod")
                .bizId(id).requestId(attempt).input(input).build());
            if(response==null || !response.isOk() || !"SUCCESS".equals(response.getStatus()) || response.getUsage()==null
                    || !"REAL_MODEL".equals(response.getUsage().get("execution_mode")) || response.getResult()==null
                    || Boolean.TRUE.equals(response.getResult().get("_fallback")))
                throw new IllegalStateException("真实视觉模型不可用，请联系运营检查模型与场景发布状态后重试");
            Map<String,Object> grounded=PestAtlasService.ground(response.getResult(),knowledge);
            Map<String,Object> result=validateResult(grounded);
            result.put("referenceIds",grounded.get("referenceIds")); result.put("knowledgeSnapshot",knowledge); result.put("imageSnapshot",imageSearch);
            result.put("traceId",response.getTraceId()); result.put("aiTaskId",response.getTaskId()); result.put("usage",response.getUsage());
            String state="RETAKE".equals(result.get("tier"))?"NEEDS_RETAKE":"DIAGNOSED";
            tx.execute(s -> {
                int updated=db.update("UPDATE agri_prod_pest_case SET status=?,result_json=?,updated_at=? WHERE id=? AND tenant_id=? AND attempt_id=? AND status='RUNNING'",
                    state,encode(result),LocalDateTime.now(),id,tenant,attempt);
                if(updated==1) event(id,tenant,"INFERENCE",Map.of("attemptId",attempt,"result",result));
                return null;
            });
        } catch(Exception e) {
            String reason=e instanceof BusinessException?e.getMessage():"真实模型调用失败或输出不符合诊断格式，请检查场景配置后重试";
            tx.execute(s -> {
                int updated=db.update("UPDATE agri_prod_pest_case SET status='FAILED',failure_message=?,updated_at=? WHERE id=? AND tenant_id=? AND attempt_id=? AND status='RUNNING'",
                    reason,LocalDateTime.now(),id,tenant,attempt);
                if(updated==1) event(id,tenant,"INFERENCE_FAILED",Map.of("attemptId",attempt,"reason",reason));
                return null;
            });
        }
    }
    /** 只接受可展示、量纲明确的结构化诊断，不把自由文本或模板当成识别结论。 */
    public static Map<String,Object> validateResult(Map<String,Object> raw) {
        if(raw==null) throw new BusinessException(422,"模型未返回诊断内容");
        String summary=bounded(raw.get("summary"),2000,true),quality=String.valueOf(raw.get("imageQuality"));
        if(!Set.of("GOOD","POOR").contains(quality)) throw new BusinessException(422,"模型未返回图片质量评级");
        if(!(raw.get("quarantineSuspected") instanceof Boolean quarantine) || !(raw.get("inKnowledgeScope") instanceof Boolean inScope))
            throw new BusinessException(422,"模型缺少检疫疑似或适用范围标记");
        String risk=String.valueOf(raw.get("riskLevel"));
        if(!Set.of("LOW","MEDIUM","HIGH","UNCERTAIN").contains(risk)) throw new BusinessException(422,"模型风险等级无效");
        if(!(raw.get("candidates") instanceof List<?> candidates) || candidates.size()>3 || ("GOOD".equals(quality) && candidates.isEmpty()))
            throw new BusinessException(422,"模型候选病因应为Top3以内");
        List<Map<String,Object>> normalized=new ArrayList<>();
        for(Object item:candidates) {
            if(!(item instanceof Map<?,?> c) || !(c.get("confidence") instanceof Number number)) throw new BusinessException(422,"候选病因格式无效");
            double confidence=number.doubleValue();
            if(!Double.isFinite(confidence) || confidence<0 || confidence>1) throw new BusinessException(422,"置信度必须为0到1");
            normalized.add(Map.of("name",bounded(c.get("name"),200,true),"confidence",confidence,"evidence",bounded(c.get("evidence"),2000,true)));
        }
        normalized.sort((a,b)->Double.compare((double)b.get("confidence"),(double)a.get("confidence")));
        double confidence=normalized.isEmpty()?0:(double)normalized.get(0).get("confidence");
        String names=normalized.stream().map(c->String.valueOf(c.get("name"))).reduce("",(a,b)->a+" "+b);
        boolean confused=names.contains("药害") || names.contains("缺素") || names.contains("病毒") || names.contains("缺镁");
        String tier=quarantine?"REPORT":("POOR".equals(quality)?"RETAKE":(!inScope || confidence<0.60?"EXPERT":(confidence<0.85 || confused?"SUSPECTED":"HIGH_CONFIDENCE")));
        var result=new LinkedHashMap<String,Object>();
        result.put("summary",summary); result.put("riskLevel",risk); result.put("candidates",normalized);
        result.put("suggestions",bounded(raw.get("suggestions"),5000,true));
        result.put("missingEvidence",bounded(raw.get("missingEvidence"),2000,false));
        result.put("imageQuality",quality); result.put("qualityGuidance",bounded(raw.get("qualityGuidance"),1000,"POOR".equals(quality)));
        result.put("quarantineSuspected",quarantine); result.put("inKnowledgeScope",inScope); result.put("tier",tier);
        result.put("knowledgeReferences",bounded(raw.get("knowledgeReferences"),2000,false));
        result.put("needsReview",true);
        result.put("rulesVersion","pest-v1-0.60-0.85-7d");
        result.put("medicationPolicy","农药登记库尚未接通，不自动生成药剂剂量或安全间隔；须人工核对登记范围与标签");
        return result;
    }
    public static void validateImages(List<String> images) {
        if(images==null || images.isEmpty() || images.size()>3) throw new BusinessException(400,"请提供1至3张JPEG或PNG图片");
        for(String image:images) {
            if(image==null || image.length()>1_400_000 || !(image.startsWith("data:image/jpeg;base64,") || image.startsWith("data:image/png;base64,")))
                throw new BusinessException(400,"图片仅支持JPEG/PNG，每张不超过1MB");
            try {
                byte[] bytes=Base64.getDecoder().decode(image.substring(image.indexOf(',')+1));
                if(bytes.length==0 || bytes.length>1024*1024) throw new IllegalArgumentException();
                try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                    var readers=ImageIO.getImageReaders(stream);
                    if(!readers.hasNext()) throw new IllegalArgumentException();
                    var reader=readers.next();
                    try {
                        reader.setInput(stream); String format=reader.getFormatName();
                        if(!(format.equalsIgnoreCase("JPEG") && image.startsWith("data:image/jpeg")) && !(format.equalsIgnoreCase("PNG") && image.startsWith("data:image/png"))) throw new IllegalArgumentException();
                        int w=reader.getWidth(0),h=reader.getHeight(0);
                        if(w<32 || h<32 || (long)w*h>20_000_000) throw new IllegalArgumentException();
                        if(reader.read(0)==null) throw new IllegalArgumentException();
                    } finally { reader.dispose(); }
                }
            } catch(Exception e) { throw new BusinessException(400,"图片无效，请使用真实JPEG/PNG，边长至少32像素且不超过2000万像素"); }
        }
    }
    public Map<String,Object> list(String tenant,String farmId,String plotId,String status,int page,int size) {
        page=Math.max(1,page); size=Math.max(1,Math.min(50,size));
        var args=new ArrayList<Object>(); args.add(tenant);
        String where=" WHERE tenant_id=?";
        if(farmId!=null && !farmId.isBlank()) { where+=" AND farm_id=?"; args.add(farms.resolveFilter(farmId,tenant)); }
        if(plotId!=null && !plotId.isBlank()) { where+=" AND plot_id=?"; args.add(plotIds.require(plotId,tenant)); }
        if(status!=null && !status.isBlank()) { where+=" AND status=?"; args.add(status); }
        Long total=db.queryForObject("SELECT COUNT(*) FROM agri_prod_pest_case"+where,Long.class,args.toArray());
        var paged=new ArrayList<>(args); paged.add(size); paged.add((page-1)*size);
        var records=db.query("SELECT id,plot_name,crop_name,status,task_id,failure_message,created_at,updated_at FROM agri_prod_pest_case"+where+" ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",(r,n)->summary(r),paged.toArray());
        return Map.of("list",records,"total",total==null?0:total,"pageNum",page,"pageSize",size);
    }
    private Map<String,Object> summary(ResultSet r) throws SQLException {
        var m=new LinkedHashMap<String,Object>();
        m.put("id",r.getString("id")); m.put("plotName",r.getString("plot_name")); m.put("cropName",r.getString("crop_name"));
        m.put("status",r.getString("status")); m.put("taskId",r.getString("task_id")); m.put("failureMessage",r.getString("failure_message"));
        m.put("createdAt",r.getTimestamp("created_at").toLocalDateTime().toString()); m.put("updatedAt",r.getTimestamp("updated_at").toLocalDateTime().toString()); return m;
    }
    public Map<String,Object> detail(String id,String tenant,boolean lock) {
        var rows=db.query("SELECT * FROM agri_prod_pest_case WHERE id=? AND tenant_id=?"+(lock?" FOR UPDATE":""),(r,n)->{
            var m=summary(r); m.put("farmId",r.getString("farm_id")); m.put("plotId",r.getString("plot_id")); m.put("createdBy",r.getString("created_by"));
            m.put("input",decode(r.getString("input_json"))); m.put("result",decode(r.getString("result_json"))); m.put("review",decode(r.getString("review_json")));
            m.put("feedback",decode(r.getString("feedback_json"))); return m;
        },id,tenant);
        if(rows.isEmpty()) throw new BusinessException(404,"病例不存在或不属于当前主体");
        var row=rows.get(0);
        var events=db.query("SELECT event_type,payload_json,created_at FROM agri_prod_pest_event WHERE case_id=? AND tenant_id=? ORDER BY created_at,id",(r,n)->
            Map.of("type",r.getString("event_type"),"payload",decode(r.getString("payload_json")),"createdAt",r.getTimestamp("created_at").toLocalDateTime().toString()),id,tenant);
        row.put("events",events);
        var snapshots=db.query("SELECT attempt_id,snapshot_json,created_at FROM agri_prod_pest_knowledge_snapshot WHERE case_id=? AND tenant_id=? ORDER BY created_at,attempt_id",(r,n)->
            Map.of("attemptId",r.getString("attempt_id"),"snapshot",decode(r.getString("snapshot_json")),"createdAt",r.getTimestamp("created_at").toLocalDateTime().toString()),id,tenant);
        row.put("knowledgeAttempts",snapshots);
        var imageSnapshots=db.query("SELECT attempt_id,snapshot_json,created_at FROM agri_prod_pest_image_snapshot WHERE case_id=? AND tenant_id=? ORDER BY created_at,attempt_id",(r,n)->
            Map.of("attemptId",r.getString("attempt_id"),"snapshot",decode(r.getString("snapshot_json")),"createdAt",r.getTimestamp("created_at").toLocalDateTime().toString()),id,tenant);
        row.put("imageAttempts",imageSnapshots);
        Map<String,Object> result=row.get("result") instanceof Map<?,?>?cast(row.get("result")):Map.of();
        String tier=String.valueOf(result.getOrDefault("tier","EXPERT"));
        LocalDateTime created=LocalDateTime.parse(String.valueOf(row.get("createdAt")));
        LocalDateTime followStart=row.get("review") instanceof Map<?,?> review?LocalDateTime.parse(String.valueOf(review.get("reviewedAt"))):created;
        row.put("followUpDueAt",followStart.plusDays(7).toString());
        row.put("sampleDueAt","SUSPECTED".equals(tier)?created.plusHours(48).toString():null);
        row.put("reportDueAt","REPORT".equals(tier)?created.toLocalDate().atTime(23,59,59).toString():null);
        List<Map<String,Object>> recent=db.query("SELECT review_json FROM agri_prod_pest_case WHERE tenant_id=? AND plot_id=? AND review_json IS NOT NULL ORDER BY created_at DESC,id DESC LIMIT 3",(r,n)->cast(decode(r.getString(1))),tenant,Long.valueOf(String.valueOf(row.get("plotId"))));
        row.put("modelRecallRequired",recent.size()==3 && recent.stream().allMatch(r->Boolean.FALSE.equals(r.get("modelCorrect"))));
        List<?> feedback=row.get("feedback") instanceof List<?> list?list:List.of();
        String latestOutcome=feedback.isEmpty()?"":Objects.toString(cast(feedback.get(feedback.size()-1)).get("outcome"),"");
        boolean followUpEscalation="WORSE".equals(latestOutcome) || (!"CLOSED".equals(row.get("status")) && LocalDateTime.now().isAfter(followStart.plusDays(7)) && !Set.of("RESOLVED","IMPROVED").contains(latestOutcome));
        row.put("expertRequired","EXPERT".equals(tier) || followUpEscalation);
        row.put("followUpOverdue",LocalDateTime.now().isAfter(followStart.plusDays(7)) && !"CLOSED".equals(row.get("status")));
        return row;
    }
    public Map<String,Object> review(String id,String tenant,String conclusion,String advice,Boolean modelCorrect) {
        requireCaseOwner();
        return tx.execute(s->{
            var row=detail(id,tenant,true);
            if(!Set.of("DIAGNOSED","FAILED","REVIEWED").contains(String.valueOf(row.get("status")))) throw new BusinessException(409,"当前状态不能核验");
            if(modelCorrect==null) throw new BusinessException(400,"请标明模型判断是否正确，供效果评估与误诊回溯使用");
            var review=Map.of("conclusion",bounded(conclusion,2000,true),"advice",bounded(advice,5000,true),"modelCorrect",modelCorrect,"reviewer",TenantContextService.currentOperator(),"reviewedAt",LocalDateTime.now().toString());
            event(id,tenant,"REVIEW",review);
            db.update("UPDATE agri_prod_pest_case SET review_json=?,status='REVIEWED',updated_at=? WHERE id=? AND tenant_id=?",encode(review),LocalDateTime.now(),id,tenant);
            return detail(id,tenant,false);
        });
    }
    public Map<String,Object> createTask(String id,String tenant,TaskSaveDTO dto) {
        requireCaseOwner();
        return tx.execute(s->{
            var row=detail(id,tenant,true);
            if(row.get("taskId")!=null) return row;
            if(!"REVIEWED".equals(row.get("status"))) throw new BusinessException(409,"请先人工核验再转农事任务");
            if(row.get("result") instanceof Map<?,?> result && Boolean.TRUE.equals(result.get("quarantineSuspected")))
                throw new BusinessException(409,"检疫性病害疑似不得自行创建防治任务，请先上报属地机构并按其意见处理");
            if(Boolean.TRUE.equals(row.get("expertRequired")) && !resolved(row,"EXPERT"))
                throw new BusinessException(409,"该病例需专家复核，请先记录专家办理结论");
            dto.setFarmId(String.valueOf(row.get("farmId"))); dto.setPlotId(Long.valueOf(String.valueOf(row.get("plotId"))));
            dto.setTaskType("pest_control"); dto.setCropName(String.valueOf(row.get("cropName")));
            dto.setTaskName(bounded(dto.getTaskName(),100,true));
            if(dto.getPlanStartDate()==null || dto.getPlanEndDate()==null)
                throw new BusinessException(400,"请填写计划执行起止时间");
            try {
                var start=LocalDateTime.parse(dto.getPlanStartDate().replace(' ','T'));
                var end=LocalDateTime.parse(dto.getPlanEndDate().replace(' ','T'));
                if(!end.isAfter(start)) throw new IllegalArgumentException();
            } catch(Exception e) { throw new BusinessException(400,"计划结束时间必须晚于开始时间"); }
            var review=cast(row.get("review"));
            dto.setDescription("诊断病例："+id+"\n核验结论："+review.get("conclusion")+"\n处置建议："+review.get("advice"));
            dto.setRemark("来源：多模态病虫害诊断 "+id);
            var task=tasks.save(dto,tenant);
            db.update("UPDATE agri_prod_pest_case SET task_id=?,status='FOLLOW_UP',updated_at=? WHERE id=? AND tenant_id=?",task.getId(),LocalDateTime.now(),id,tenant);
            return detail(id,tenant,false);
        });
    }
    public Map<String,Object> followUp(String id,String tenant,String outcome,String note,boolean close) {
        requireCaseOwner();
        return tx.execute(s->{
            var row=detail(id,tenant,true);
            if(!Set.of("REVIEWED","FOLLOW_UP").contains(String.valueOf(row.get("status")))) throw new BusinessException(409,"当前状态不能随访或结案");
            if(!Set.of("IMPROVED","UNCHANGED","WORSE","RESOLVED").contains(outcome)) throw new BusinessException(400,"请选择有效的观察结果");
            if(close && !Set.of("IMPROVED","RESOLVED").contains(outcome)) throw new BusinessException(400,"未改善或恶化病例不能结案，请继续跟踪");
            if(close && row.get("result") instanceof Map<?,?> result && Boolean.TRUE.equals(result.get("quarantineSuspected")) && !resolved(row,"REPORT"))
                throw new BusinessException(409,"检疫疑似需完成属地机构上报及处置意见留痕后才能结案");
            if(close && Boolean.TRUE.equals(row.get("expertRequired")) && !resolved(row,"EXPERT"))
                throw new BusinessException(409,"该病例需完成专家复核后才能结案");
            if(close && row.get("taskId")!=null) {
                var task=tasks.getById(Long.valueOf(String.valueOf(row.get("taskId"))),tenant);
                if(task==null || !Integer.valueOf(1).equals(task.getAcceptStatus()) || !Set.of("completed","done").contains(Objects.toString(task.getStatus(),"")))
                    throw new BusinessException(409,"关联农事任务尚未完成验收，不能结案");
            }
            List<Object> entries=row.get("feedback") instanceof List<?> old?new ArrayList<>(old):new ArrayList<>();
            entries.add(Map.of("outcome",outcome,"note",bounded(note,2000,true),"closed",close,"operator",TenantContextService.currentOperator(),"createdAt",LocalDateTime.now().toString()));
            db.update("UPDATE agri_prod_pest_case SET feedback_json=?,status=?,updated_at=? WHERE id=? AND tenant_id=?",encode(entries),close?"CLOSED":"FOLLOW_UP",LocalDateTime.now(),id,tenant);
            return detail(id,tenant,false);
        });
    }
    public Map<String,Object> handoff(String id,String tenant,Map<String,String> input) {
        requireCaseOwner();
        return tx.execute(s->{
            var row=detail(id,tenant,true);
            if(Set.of("CLOSED","RUNNING","NEEDS_RETAKE").contains(String.valueOf(row.get("status")))) throw new BusinessException(409,"当前状态不能办理转接");
            String kind=input.get("kind"),state=input.get("state");
            if(!Set.of("EXPERT","REPORT","SAMPLE").contains(Objects.toString(kind,"")) || !Set.of("PENDING","SUBMITTED","RESOLVED").contains(Objects.toString(state,"")))
                throw new BusinessException(400,"请选择有效的办理类型和状态");
            String receipt=bounded(input.get("receipt"),200,!"PENDING".equals(state));
            String note=bounded(input.get("note"),3000,true);
            event(id,tenant,"HANDOFF",Map.of("kind",kind,"state",state,"target",bounded(input.get("target"),200,true),"receipt",receipt,"note",note,"operator",TenantContextService.currentOperator()));
            db.update("UPDATE agri_prod_pest_case SET updated_at=? WHERE id=? AND tenant_id=?",LocalDateTime.now(),id,tenant);
            return detail(id,tenant,false);
        });
    }
    private static boolean resolved(Map<String,Object> row,String kind) {
        if(!(row.get("events") instanceof List<?> events)) return false;
        for(int i=events.size()-1;i>=0;i--) {
            Map<String,Object> e=cast(events.get(i));
            if("HANDOFF".equals(e.get("type"))) {
                Map<String,Object> p=cast(e.get("payload"));
                if(kind.equals(p.get("kind"))) return "RESOLVED".equals(p.get("state"));
            }
        }
        return false;
    }
    private void event(String id,String tenant,String type,Object payload) {
        db.update("INSERT INTO agri_prod_pest_event(id,case_id,tenant_id,event_type,payload_json,created_at) VALUES(?,?,?,?,?,?)",UUID.randomUUID().toString(),id,tenant,type,encode(payload),LocalDateTime.now());
    }
    private static void requireCaseOwner() {
        if(!"owner".equalsIgnoreCase(TenantContextService.currentMerchantRole()))
            throw new BusinessException(403,"仅当前主体负责人可核验诊断、创建处置任务及结案");
    }
    private static String bounded(Object value,int max,boolean required) {
        String s=value instanceof String?((String)value).trim():"";
        if((required && s.isEmpty()) || s.length()>max) throw new BusinessException(400,"文本为空或长度超出限制"); return s;
    }
    @SuppressWarnings("unchecked") private static Map<String,Object> cast(Object value) { return (Map<String,Object>)value; }
    private String encode(Object o) { try { return json.writeValueAsString(o); } catch(Exception e) { throw new IllegalStateException("病例序列化失败",e); } }
    private Object decode(String s) { try { return s==null?null:json.readValue(s,Object.class); } catch(Exception e) { throw new IllegalStateException("病例数据无法读取",e); } }
    @SuppressWarnings("unchecked") private static List<String> strings(Object value) {
        if (value instanceof List<?> list) return list.stream().map(String::valueOf).toList();
        return List.of();
    }
    private static String sha256(String s) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8))); } catch(Exception e) { throw new IllegalStateException(e); } }
}
