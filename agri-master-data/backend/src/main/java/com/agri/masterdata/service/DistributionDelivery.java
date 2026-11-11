package com.agri.masterdata.service;

import com.agri.masterdata.entity.DistributionTask;
import com.agri.masterdata.mapper.DistributionTaskMapper;
import com.agri.common.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;

/** 主数据自己的可靠分发执行器。目标必须实现幂等键去重并返回持久化回执。 */
@Service
public class DistributionDelivery {
    public record Submit(String taskName, String targetSystem, String dataType, String tenantId, JsonNode records) {}
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    private final DistributionTaskMapper tasks;
    private final ObjectMapper json;
    private final Environment env;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    public DistributionDelivery(JdbcTemplate db, org.springframework.transaction.PlatformTransactionManager tm,
            DistributionTaskMapper tasks, ObjectMapper json, Environment env) {
        this.db=db; this.tx=new TransactionTemplate(tm); this.tasks=tasks; this.json=json; this.env=env;
    }
    public Long submit(Submit request) {
        if(request==null || request.taskName()==null || request.taskName().isBlank() || request.taskName().length()>100 ||
           request.dataType()==null || !request.dataType().matches("[a-zA-Z0-9_.-]{1,50}") || request.tenantId()==null || request.tenantId().isBlank() ||
           request.records()==null || !request.records().isArray() || request.records().isEmpty() || request.records().size()>1000)
            throw new BusinessException("请提供任务名称、主体、数据类型和1至1000条真实主数据记录");
        endpoint(request.targetSystem());
        String key=UUID.randomUUID().toString();
        return tx.execute(status -> {
            DistributionTask task=new DistributionTask(); task.setTaskCode("MD-"+key); task.setTaskName(request.taskName());
            task.setTargetSystem(request.targetSystem());task.setTargetSystemName(request.targetSystem());
            task.setDataType(request.dataType());task.setDataTypeName(request.dataType());task.setTenantId(request.tenantId());
            task.setTriggerType("manual");task.setStatus("pending");task.setTotalCount(request.records().size());
            task.setSuccessCount(0);task.setFailedCount(0);task.setProgress(0);task.setDelFlag(0);tasks.insert(task);
            String body=encode(Map.of("taskId",String.valueOf(task.getId()),"tenantId",request.tenantId(),"dataType",request.dataType(),
                "schemaVersion",1,"idempotencyKey",key,"records",request.records()));
            if(body.length()>2_000_000) throw new BusinessException("分发快照不得超过2MB");
            db.update("INSERT INTO agri_md_distribution_delivery(task_id,idempotency_key,payload,state) VALUES(?,?,?,'queued')",task.getId(),key,body);
            return task.getId();
        });
    }
    public void retry(Long id) {
        tx.executeWithoutResult(status -> {
            var rows=db.queryForList("SELECT * FROM agri_md_distribution_delivery WHERE task_id=? FOR UPDATE",id);
            if(rows.isEmpty()) throw new BusinessException("该历史任务缺少原始分发快照，无法安全重放；请重新创建真实分发任务");
            var row=rows.get(0);
            DistributionTask task=tasks.selectById(id);
            if(task==null) throw new BusinessException("分发任务不存在");
            if(!"failed".equals(task.getStatus())) throw new BusinessException("只有失败任务才能重试");
            endpoint(task.getTargetSystem());
            db.update("UPDATE agri_md_distribution_delivery SET state='queued',claim_token=NULL,claim_until=NULL WHERE task_id=?",id);
            db.update("UPDATE agri_md_distribution_task SET status='pending',progress=0,success_count=0,failed_count=0,error_message=NULL,end_time=NULL,delay=NULL,update_time=NOW() WHERE id=?",id);
        });
    }
    public void pause(Long id) {
        tx.executeWithoutResult(status -> {
            if(db.update("UPDATE agri_md_distribution_delivery SET state='paused' WHERE task_id=? AND state='queued'",id)!=1)
                throw new BusinessException("仅能暂停等待执行的可重放任务；已发出的请求须等待回执");
            db.update("UPDATE agri_md_distribution_task SET status='paused',update_time=NOW() WHERE id=?",id);
        });
    }
    public void resume(Long id) {
        tx.executeWithoutResult(status -> {
            if(db.update("UPDATE agri_md_distribution_delivery SET state='queued' WHERE task_id=? AND state='paused'",id)!=1)
                throw new BusinessException("任务未暂停或缺少分发快照");
            db.update("UPDATE agri_md_distribution_task SET status='pending',update_time=NOW() WHERE id=?",id);
        });
    }
    private URI endpoint(String target) {
        if(target==null || !target.matches("[a-zA-Z0-9-]{1,50}")) throw new BusinessException("目标系统编码无效");
        String address=env.getProperty("agri.distribution.targets."+target+".url","");
        try {
            URI uri=URI.create(address);
            if(!Set.of("http","https").contains(uri.getScheme()) || uri.getHost()==null || uri.getUserInfo()!=null || uri.getFragment()!=null)
                throw new IllegalArgumentException();
            return uri;
        } catch(Exception e) { throw new BusinessException("目标系统未配置有效的分发接收地址："+target); }
    }
    @Scheduled(fixedDelayString="${agri.distribution.interval-ms:3000}")
    public void tick() {
        for(var row:db.queryForList("SELECT task_id FROM agri_md_distribution_delivery WHERE state='queued' OR (state='running' AND claim_until<NOW()) ORDER BY task_id LIMIT 3")) {
            try { execute(((Number)row.get("task_id")).longValue()); }
            catch(RuntimeException e) { org.slf4j.LoggerFactory.getLogger(getClass()).warn("主数据分发执行失败 taskId={}",row.get("task_id"),e); }
        }
    }
    public void execute(Long id) {
        String token=UUID.randomUUID().toString();
        Map<String,Object> row=tx.execute(status -> {
            if(db.update("UPDATE agri_md_distribution_delivery SET state='running',claim_token=?,claim_until=DATE_ADD(NOW(), INTERVAL 120 SECOND),attempts=attempts+1 WHERE task_id=? AND (state='queued' OR (state='running' AND claim_until<NOW()))",token,id)!=1) return null;
            db.update("UPDATE agri_md_distribution_task SET status='running',start_time=NOW(),end_time=NULL,error_message=NULL,update_time=NOW() WHERE id=?",id);
            return db.queryForMap("SELECT * FROM agri_md_distribution_delivery WHERE task_id=?",id);
        });
        if(row==null) return;
        long started=System.nanoTime(); String error=null,receipt=null; boolean success=false;
        DistributionTask task=tasks.selectById(id);
        try {
            if(task==null) throw new IllegalStateException("分发任务不存在");
            var builder=HttpRequest.newBuilder(endpoint(task.getTargetSystem())).timeout(Duration.ofSeconds(30))
                .header("Content-Type","application/json").header("Idempotency-Key",row.get("idempotency_key").toString());
            String credential=env.getProperty("agri.distribution.targets."+task.getTargetSystem()+".token","");
            if(!credential.isBlank()) builder.header("X-Internal-Token",credential);
            var response=http.send(builder.POST(HttpRequest.BodyPublishers.ofString(row.get("payload").toString())).build(),HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()<200 || response.statusCode()>=300) throw new IllegalStateException("目标返回HTTP "+response.statusCode());
            JsonNode responseRoot=json.readTree(response.body());
            int responseCode=responseRoot.path("code").asInt(0);
            if(responseRoot.has("code") && responseCode!=0 && responseCode!=200)
                throw new IllegalStateException("目标接口业务失败，code="+responseCode);
            // 核心平台使用 ApiResponse 包装回执；其它责任域可直接返回裸回执。
            JsonNode ack=responseRoot.has("data") && responseRoot.path("data").isObject()
                    ? responseRoot.path("data") : responseRoot;
            if(!ack.path("success").asBoolean() || !row.get("idempotency_key").equals(ack.path("idempotencyKey").asText()) ||
                ack.path("acceptedCount").asInt(-1)!=task.getTotalCount() || ack.path("receiptId").asText().isBlank())
                throw new IllegalStateException("目标业务回执无效或数量不一致，结果待核验；重试沿用原幂等键");
            receipt=encode(ack);success=true;
        } catch(Exception e) {
            if(e instanceof InterruptedException) Thread.currentThread().interrupt();
            error=e instanceof java.net.http.HttpTimeoutException ? "目标响应超时，结果待核验；重试使用原幂等键" : Objects.toString(e.getMessage(),"分发失败");
        }
        final boolean ok=success;final String failure=error==null?null:error.substring(0,Math.min(500,error.length()));
        final String ack=receipt;final double delay=(System.nanoTime()-started)/1_000_000_000.0;
        tx.executeWithoutResult(status -> {
            if(db.update("UPDATE agri_md_distribution_delivery SET state=?,receipt=?,last_error=?,claim_until=NULL WHERE task_id=? AND claim_token=? AND state='running'",ok?"success":"failed",ack,failure,id,token)!=1) return;
            db.update("INSERT INTO agri_md_distribution_attempt(task_id,attempt_token,success,receipt,error_message) VALUES(?,?,?,?,?)",id,token,ok,ack,failure);
            db.update("UPDATE agri_md_distribution_task SET status=?,success_count=?,failed_count=?,progress=100,delay=?,error_message=?,end_time=NOW(),update_time=NOW() WHERE id=?",ok?"success":"failed",ok?task.getTotalCount():0,ok?0:task.getTotalCount(),delay,failure,id);
        });
    }
    private String encode(Object value) { try { return json.writeValueAsString(value); } catch(Exception e) { throw new BusinessException("分发数据无法序列化"); } }
}
