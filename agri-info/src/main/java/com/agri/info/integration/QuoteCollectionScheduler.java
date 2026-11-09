package com.agri.info.integration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** 数据库持久化的行情调度；多实例通过条件更新竞争租约，不在事务中执行网络请求。 */
@Service
@EnableScheduling
public class QuoteCollectionScheduler {
    private static final Logger LOG = LoggerFactory.getLogger(QuoteCollectionScheduler.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final JdbcTemplate jdbc;
    private final QuoteCollectionService collection;
    private final TransactionTemplate tx;
    public QuoteCollectionScheduler(JdbcTemplate jdbc, QuoteCollectionService collection,
            org.springframework.transaction.PlatformTransactionManager manager) {
        this.jdbc=jdbc; this.collection=collection; this.tx=new TransactionTemplate(manager);
    }
    static LocalDateTime next(String cron, LocalDateTime after) {
        String[] parts=cron.trim().split("\\s+");
        if(parts.length!=6 || !parts[0].matches("[0-5]?[0-9]"))
            throw new IllegalArgumentException("请输入六段 Cron，秒位须为0至59的固定整数，间隔至少60秒");
        CronExpression expression;
        try { expression=CronExpression.parse(cron); }
        catch (Exception e) { throw new IllegalArgumentException("请输入有效的六段 Cron：秒 分 时 日 月 周"); }
        // 以实际相邻触发时间校验最小频率，避免高频请求。
        LocalDateTime first=expression.next(after), second=first==null?null:expression.next(first);
        if(first==null || second==null) throw new IllegalArgumentException("Cron 没有可用的下一次执行时间");
        if(Duration.between(first,second).getSeconds()<60) throw new IllegalArgumentException("自动采集间隔不能短于60秒");
        return first;
    }
    private static LocalDateTime now() { return LocalDateTime.now(ZONE); }
    private static String stamp(LocalDateTime time) { return time.format(FORMAT); }
    public Map<String,Object> config(long id) {
        if(jdbc.queryForObject("SELECT COUNT(*) FROM info_collect_task WHERE id=?",Integer.class,id)==0)
            throw new IllegalArgumentException("采集任务不存在");
        var rows=jdbc.queryForList("SELECT enabled,cron_expression AS cron,max_retries AS maxRetries,retry_seconds AS retrySeconds,next_run_at AS nextRunAt,retry_count AS retryCount,last_result AS lastResult,lease_until AS leaseUntil FROM info_collect_schedule WHERE task_id=?",id);
        if(!rows.isEmpty()) return rows.get(0);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("enabled",false); result.put("cron","0 0 * * * *"); result.put("maxRetries",2);
        result.put("retrySeconds",60); result.put("retryCount",0); result.put("lastResult","尚未启用自动调度");
        return result;
    }
    private static int integer(Map<String,Object> body,String key,int min,int max) {
        try {
            int n=new java.math.BigDecimal(Objects.toString(body.get(key))).intValueExact();
            if(n<min||n>max) throw new NumberFormatException(); return n;
        } catch(Exception e) { throw new IllegalArgumentException(key+" 必须是 "+min+" 至 "+max+" 的整数"); }
    }
    public Map<String,Object> save(long id,Map<String,Object> body,String operator) {
        boolean enabled=Boolean.TRUE.equals(body.get("enabled"));
        String cron=Objects.toString(body.get("cron"),"").trim();
        if(cron.length()>60) throw new IllegalArgumentException("Cron 不能超过60字符");
        LocalDateTime time=now(), due=next(cron,time);
        int retries=integer(body,"maxRetries",0,3), seconds=integer(body,"retrySeconds",60,3600);
        tx.executeWithoutResult(s -> {
            // 锁定任务行，和采集服务的任务锁串行化配置变更。
            var tasks=jdbc.queryForList("SELECT id FROM info_collect_task WHERE id=? FOR UPDATE",id);
            if(tasks.isEmpty()) throw new IllegalArgumentException("采集任务不存在");
            if(enabled && jdbc.queryForObject("SELECT COUNT(*) FROM info_collect_config WHERE task_id=? AND enabled=TRUE",Integer.class,id)==0)
                throw new IllegalArgumentException("请先保存并启用已授权的数据源接入配置");
            var current=jdbc.queryForList("SELECT lease_until FROM info_collect_schedule WHERE task_id=? FOR UPDATE",id);
            // 暂停可以立即阻止后续调度；已发出的采集请求允许完成。
            if(enabled && !current.isEmpty() && current.get(0).get("lease_until")!=null && current.get(0).get("lease_until").toString().compareTo(stamp(time))>0)
                throw new IllegalArgumentException("自动采集执行中，请稍后修改；可以先暂停后续调度");
            String result=enabled?"已启用，等待下次执行":"已暂停；正在执行的采集不强制中断";
            if(current.isEmpty()) jdbc.update("INSERT INTO info_collect_schedule(task_id,enabled,cron_expression,max_retries,retry_seconds,next_run_at,retry_count,last_result) VALUES(?,?,?,?,?,?,0,?)",id,enabled,cron,retries,seconds,enabled?stamp(due):null,result);
            else jdbc.update("UPDATE info_collect_schedule SET enabled=?,cron_expression=?,max_retries=?,retry_seconds=?,next_run_at=?,retry_count=0,last_result=?,lease_token=NULL,lease_until=NULL WHERE task_id=?",enabled,cron,retries,seconds,enabled?stamp(due):null,result,id);
            jdbc.update("UPDATE info_collect_task SET cron_text=? WHERE id=?",cron,id);
            jdbc.update("INSERT INTO info_audit_log(operator_name,action_name,target_name,detail) VALUES(?,?,?,?)",operator,"配置自动行情调度","任务#"+id,"启用="+enabled+"；Cron="+cron+"；重试="+retries+"；退避秒数="+seconds);
        });
        return Map.of("message",enabled?"自动调度已启用（北京时间）":"自动调度已暂停");
    }
    @Scheduled(fixedDelayString="${agri.info.collection.scan-delay-ms:15000}",initialDelay=15000)
    public void tick() {
        try {
            var due=jdbc.queryForList("SELECT s.* FROM info_collect_schedule s JOIN info_collect_config c ON c.task_id=s.task_id AND c.enabled=TRUE WHERE s.enabled=TRUE AND s.next_run_at<=? AND (s.lease_until IS NULL OR s.lease_until<?) ORDER BY s.next_run_at LIMIT 20",stamp(now()),stamp(now()));
            for(var row:due) {
                try { execute(row); }
                catch(Exception e) { LOG.error("行情自动调度任务 {} 执行失败，将在租约到期后恢复",row.get("task_id"),e); }
            }
        } catch(Exception e) { LOG.error("行情自动调度扫描失败，下次扫描重试",e); }
    }
    void execute(Map<String,Object> row) {
        long id=((Number)row.get("task_id")).longValue(); String token=UUID.randomUUID().toString();
        int locked=jdbc.update("UPDATE info_collect_schedule SET lease_token=?,lease_until=? WHERE task_id=? AND enabled=TRUE AND next_run_at<=? AND (lease_until IS NULL OR lease_until<?)",token,stamp(now().plusHours(2)),id,stamp(now()),stamp(now()));
        if(locked==0) return;
        String status, detail;
        boolean busy=false;
        try {
            var result=collection.run(id,"系统自动调度"); status=Objects.toString(result.get("status")); detail=Objects.toString(result.get("message"));
        } catch(IllegalArgumentException e) { status="failed"; detail=e.getMessage(); busy="任务正在执行，请勿重复触发".equals(detail); }
        catch(Exception e) { status="failed"; detail="调度执行异常（"+e.getClass().getSimpleName()+"），等待重试"; }
        int attempt=((Number)row.get("retry_count")).intValue(), max=((Number)row.get("max_retries")).intValue();
        int delay=((Number)row.get("retry_seconds")).intValue();
        boolean retry="failed".equals(status)&&attempt<max;
        LocalDateTime following=busy?now().plusSeconds(60):retry?now().plusSeconds((long)delay*(1L<<attempt)):next(row.get("cron_expression").toString(),now());
        String summary=(busy?"等待正在执行的任务结束":retry?"失败，安排第"+(attempt+1)+"次重试":status.equals("failed")?"重试耗尽，等待下个周期":status.equals("partial")?"部分成功，请核验拒收记录":"完成")+"；"+detail;
        jdbc.update("UPDATE info_collect_schedule SET next_run_at=?,retry_count=?,last_result=?,lease_token=NULL,lease_until=NULL WHERE task_id=? AND lease_token=?",stamp(following),busy?attempt:retry?attempt+1:0,summary.substring(0,Math.min(1900,summary.length())),id,token);
    }
}
