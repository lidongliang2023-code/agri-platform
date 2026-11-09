package com.agri.info.integration;

import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** 采集运维告警独立于用户价格预警；任务行锁保证多实例扫描和人工操作串行。 */
@Service
public class QuoteCollectionAlertService {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private static final DateTimeFormatter FORMAT=DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    public QuoteCollectionAlertService(JdbcTemplate jdbc, org.springframework.transaction.PlatformTransactionManager manager) {
        this.jdbc=jdbc; this.tx=new TransactionTemplate(manager);
    }
    private static String now() { return LocalDateTime.now(ZoneId.of("Asia/Shanghai")).format(FORMAT); }
    private void lock(long id) {
        if(jdbc.queryForList("SELECT id FROM info_collect_task WHERE id=? FOR UPDATE",id).isEmpty())
            throw new IllegalArgumentException("采集任务不存在");
    }
    private void ensure(long id) {
        if(jdbc.queryForObject("SELECT COUNT(*) FROM info_collect_alert_policy WHERE task_id=?",Integer.class,id)==0) {
            Long cursor=jdbc.queryForObject("SELECT COALESCE(MAX(id),0) FROM info_collect_run WHERE task_id=? AND status<>'running'",Long.class,id);
            jdbc.update("INSERT INTO info_collect_alert_policy(task_id,enabled,failure_threshold,reject_percent,stale_minutes,last_run_id,failure_streak,monitor_from) VALUES(?,TRUE,1,20,180,?,0,?)",id,cursor,now());
        }
    }
    public Map<String,Object> config(long id) {
        return tx.execute(s->{lock(id);ensure(id);var result=new LinkedHashMap<String,Object>(jdbc.queryForMap("SELECT enabled,failure_threshold AS failureThreshold,reject_percent AS rejectPercent,stale_minutes AS staleMinutes FROM info_collect_alert_policy WHERE task_id=?",id));
            var f=freshnessPolicy(id); result.put("freshnessEnabled",f.get("enabled")); result.put("maxAgeMinutes",f.get("max_age_minutes")); result.put("expiredPercent",f.get("expired_percent")); return result;});
    }
    private static int integer(Map<String,Object> b,String key,int min,int max) {
        try { int n=new BigDecimal(Objects.toString(b.get(key))).intValueExact(); if(n<min||n>max) throw new IllegalArgumentException(); return n; }
        catch(Exception e) { throw new IllegalArgumentException(key+" 必须是 "+min+" 至 "+max+" 的整数"); }
    }
    public Map<String,Object> save(long id,Map<String,Object> b,String operator) {
        if(!(b.get("enabled") instanceof Boolean)) throw new IllegalArgumentException("启用状态必须为布尔值");
        int failures=integer(b,"failureThreshold",1,10),reject=integer(b,"rejectPercent",1,100),stale=integer(b,"staleMinutes",5,10080);
        boolean enabled=Boolean.TRUE.equals(b.get("enabled"));
        // 老客户端未提交新字段时保留原有时效规则。
        boolean hasFreshness=b.containsKey("freshnessEnabled");
        if(hasFreshness && !(b.get("freshnessEnabled") instanceof Boolean)) throw new IllegalArgumentException("时效启用状态必须为布尔值");
        int age=hasFreshness?integer(b,"maxAgeMinutes",5,43200):1440;
        int percent=hasFreshness?integer(b,"expiredPercent",1,100):20;
        tx.executeWithoutResult(s->{
            lock(id);ensure(id);
            if(hasFreshness) {
                freshnessPolicy(id);
                jdbc.update("UPDATE info_collect_freshness_policy SET enabled=?,max_age_minutes=?,expired_percent=?,monitor_from=? WHERE task_id=?",Boolean.TRUE.equals(b.get("freshnessEnabled")),age,percent,now(),id);
                resolve(id,"source_stale","源报价时效规则变更，按新规则重新评估");
            }
            jdbc.update("UPDATE info_collect_alert_policy SET enabled=?,failure_threshold=?,reject_percent=?,stale_minutes=? WHERE task_id=?",enabled,failures,reject,stale,id);
            // 重新启用从当前时点开始监测；不会将关闭期间的批次回放成新告警。
            if(enabled) {
                jdbc.update("UPDATE info_collect_alert_policy SET monitor_from=?,failure_streak=0,last_run_id=(SELECT COALESCE(MAX(id),0) FROM info_collect_run WHERE task_id=? AND status<>'running') WHERE task_id=?",now(),id,id);
            } else resolveAll(id,"运营关闭采集告警监测");
            audit(operator,"配置采集告警",id,"启用="+enabled+"；连续失败="+failures+"；拒收率="+reject+"%；有效采集超时="+stale+"分钟；源报价时效="+(hasFreshness?b.get("freshnessEnabled")+"；最大年龄="+age+"分钟；过期占比="+percent+"%":"保留原规则"));
        });
        return Map.of("message","采集告警规则已保存");
    }
    public Map<String,Object> list(String status,Long taskId) {
        if(!Set.of("active","recovered","all").contains(status)) throw new IllegalArgumentException("告警状态无效");
        String where=" WHERE 1=1"; List<Object> args=new ArrayList<>();
        if(!"all".equals(status)) where+="active".equals(status)?" AND a.active_slot=1":" AND a.active_slot IS NULL";
        if(taskId!=null){where+=" AND a.task_id=?";args.add(taskId);}
        String select="SELECT a.id,a.task_id AS taskId,t.name AS taskName,t.source_name AS sourceName,a.alert_type AS alertType,a.severity,a.status,a.hit_count AS hitCount,a.first_at AS firstAt,a.last_at AS lastAt,a.recovered_at AS recoveredAt,a.detail,a.ack_by AS ackBy,a.ack_note AS ackNote,a.ack_at AS ackAt,a.recovery_note AS recoveryNote FROM info_collect_alert a JOIN info_collect_task t ON t.id=a.task_id";
        var items=jdbc.queryForList(select+where+" ORDER BY CASE WHEN a.active_slot=1 THEN 0 ELSE 1 END,a.last_at DESC,a.id DESC LIMIT 200",args.toArray());
        Integer count=jdbc.queryForObject("SELECT COUNT(*) FROM info_collect_alert a"+where,Integer.class,args.toArray());
        return Map.of("items",items,"total",count,"activeCount",jdbc.queryForObject("SELECT COUNT(*) FROM info_collect_alert WHERE active_slot=1",Integer.class),"freshness",freshnessList(taskId),"pendingCount",jdbc.queryForObject("SELECT COUNT(*) FROM info_collect_alert WHERE active_slot=1 AND status='open'",Integer.class));
    }
    public Map<String,Object> acknowledge(long alertId,String note,String operator) {
        String clean=note==null?"":note.trim();
        if(clean.isEmpty()||clean.length()>500) throw new IllegalArgumentException("请填写1至500字的处理说明");
        tx.executeWithoutResult(s->{
            var rows=jdbc.queryForList("SELECT task_id FROM info_collect_alert WHERE id=?",alertId);
            if(rows.isEmpty()) throw new IllegalArgumentException("告警不存在");
            long task=((Number)rows.get(0).get("task_id")).longValue(); lock(task);
            if(jdbc.update("UPDATE info_collect_alert SET status='acknowledged',ack_by=?,ack_note=?,ack_at=? WHERE id=? AND active_slot=1 AND status='open'",operator,clean,now(),alertId)==0)
                throw new IllegalArgumentException("告警已恢复或已确认，请刷新列表");
            audit(operator,"确认采集告警",task,"告警#"+alertId+"；"+clean);
        });
        return Map.of("message","已确认处理，异常消失后自动恢复");
    }
    @Scheduled(fixedDelayString="${agri.info.collection.alert-scan-delay-ms:15000}",initialDelay=20000)
    public void scan() {
        for(var t:jdbc.queryForList("SELECT id FROM info_collect_task")) {
            long id=((Number)t.get("id")).longValue();
            try { check(id); }
            catch(Exception e) { LoggerFactory.getLogger(getClass()).error("采集告警扫描任务 {} 失败，下轮重试",id,e); }
        }
    }
    void check(long id) {
        tx.executeWithoutResult(s->{
            lock(id);ensure(id);
            var p=jdbc.queryForMap("SELECT * FROM info_collect_alert_policy WHERE task_id=?",id);
            if(!Boolean.parseBoolean(Objects.toString(p.get("enabled")))) return;
            long cursor=((Number)p.get("last_run_id")).longValue(); int streak=((Number)p.get("failure_streak")).intValue();
            var runs=jdbc.queryForList("SELECT * FROM info_collect_run WHERE task_id=? AND id>? AND status<>'running' AND finished_at IS NOT NULL ORDER BY id LIMIT 100",id,cursor);
            for(var r:runs) {
                boolean failed="failed".equals(r.get("status")); streak=failed?streak+1:0;
                if(failed && streak>=((Number)p.get("failure_threshold")).intValue()) {
                    trigger(id,"failure",streak>=3?"critical":"warning","连续失败 "+streak+" 次；批次#"+r.get("id")+"；"+r.get("detail"));
                } else if(!failed) resolve(id,"failure","后续采集请求完成，连续失败中断；批次#"+r.get("id"));
                int total=((Number)r.get("total_rows")).intValue(),rejected=((Number)r.get("rejected_rows")).intValue();
                if(total>0) {
                    double rate=100.0*rejected/total;
                    if(rate>=((Number)p.get("reject_percent")).intValue()) trigger(id,"rejection",rate>=100?"critical":"warning","批次#"+r.get("id")+"；拒收 "+rejected+" / "+total+"（"+String.format(Locale.ROOT,"%.2f",rate)+"%）；"+r.get("detail"));
                    else resolve(id,"rejection","后续批次拒收率低于阈值；批次#"+r.get("id"));
                }
                cursor=((Number)r.get("id")).longValue();
            }
            jdbc.update("UPDATE info_collect_alert_policy SET last_run_id=?,failure_streak=? WHERE task_id=?",cursor,streak,id);
            boolean automatic=jdbc.queryForObject("SELECT COUNT(*) FROM info_collect_schedule s JOIN info_collect_config c ON c.task_id=s.task_id WHERE s.task_id=? AND s.enabled=TRUE AND c.enabled=TRUE",Integer.class,id)>0;
            checkFreshness(id,automatic);
            if(!automatic) {resolve(id,"stale","自动调度或数据源接入已暂停，停止超时监测");return;}
            String last=jdbc.queryForObject("SELECT MAX(finished_at) FROM info_collect_run WHERE task_id=? AND accepted_rows+duplicate_rows>0 AND finished_at IS NOT NULL",String.class,id);
            String baseline=Objects.toString(p.get("monitor_from")); if(last==null||last.compareTo(baseline)<0) last=baseline;
            long minutes=Duration.between(LocalDateTime.parse(last,FORMAT),LocalDateTime.parse(now(),FORMAT)).toMinutes();
            if(minutes>=((Number)p.get("stale_minutes")).intValue()) {
                // 超时扫描不重复累计次数；last_at 表示最近实际异常事件，不因轮询而刷屏。
                if(jdbc.queryForObject("SELECT COUNT(*) FROM info_collect_alert WHERE task_id=? AND alert_type='stale' AND active_slot=1",Integer.class,id)==0)
                    trigger(id,"stale","warning","已 "+minutes+" 分钟无有效采集完成；最近有效完成/监测起点："+last+"。有效指至少入库或确认重复1行，不代表报价观测时间新鲜。");
            } else resolve(id,"stale","已有有效采集完成，超时解除");
        });
    }

    private Map<String,Object> freshnessPolicy(long id) {
        if(jdbc.queryForObject("SELECT COUNT(*) FROM info_collect_freshness_policy WHERE task_id=?",Integer.class,id)==0)
            jdbc.update("INSERT INTO info_collect_freshness_policy(task_id,monitor_from) VALUES(?,?)",id,now());
        return jdbc.queryForMap("SELECT * FROM info_collect_freshness_policy WHERE task_id=?",id);
    }
    private List<Map<String,Object>> freshnessList(Long taskId) {
        var tasks=jdbc.queryForList("SELECT id,name,source_name FROM info_collect_task"+(taskId==null?"":" WHERE id=?"),taskId==null?new Object[]{}:new Object[]{taskId});
        List<Map<String,Object>> result=new ArrayList<>();
        for(var t:tasks) {
            long id=((Number)t.get("id")).longValue();
            var rows=jdbc.queryForList("SELECT * FROM info_collect_freshness_policy WHERE task_id=?",id);
            var f=rows.isEmpty()?Map.<String,Object>of("enabled",false,"max_age_minutes",1440,"expired_percent",20,"monitor_from",now()):rows.get(0);
            var item=freshness(id,f); item.put("taskId",id);item.put("taskName",t.get("name"));item.put("sourceName",t.get("source_name"));result.add(item);
        }
        return result;
    }
    // 每条在线报价取最新原始观测；采集完成时间和价格涨跌均不参与时效判断。
    private Map<String,Object> freshness(long id,Map<String,Object> f) {
        int age=((Number)f.get("max_age_minutes")).intValue(),threshold=((Number)f.get("expired_percent")).intValue();
        String cutoff=LocalDateTime.parse(now(),FORMAT).minusMinutes(age).format(FORMAT);
        var stats=jdbc.queryForMap("SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN x.observed_at<=? THEN 1 ELSE 0 END),0) AS expired,MIN(x.observed_at) AS oldest,MAX(x.observed_at) AS latest FROM (SELECT o.quote_code,MAX(o.observed_at) AS observed_at FROM info_collect_observation o JOIN info_quote q ON q.code=o.quote_code AND q.status='online' WHERE o.task_id=? GROUP BY o.quote_code) x",cutoff,id);
        long total=((Number)stats.get("total")).longValue(),expired=((Number)stats.get("expired")).longValue();
        boolean active=Boolean.parseBoolean(Objects.toString(f.get("enabled"))) && jdbc.queryForObject("SELECT COUNT(*) FROM info_collect_alert_policy p JOIN info_collect_schedule s ON s.task_id=p.task_id JOIN info_collect_config c ON c.task_id=p.task_id WHERE p.task_id=? AND p.enabled=TRUE AND s.enabled=TRUE AND c.enabled=TRUE",Integer.class,id)>0;
        String state=!active?"paused":total==0?"no_samples":expired*100>=total*threshold?"expired":"healthy";
        Map<String,Object> r=new LinkedHashMap<>();r.put("state",state);r.put("total",total);r.put("expired",expired);
        r.put("expiredPercent",total==0?null:BigDecimal.valueOf(expired*100.0/total).setScale(2,java.math.RoundingMode.HALF_UP));
        r.put("oldestObservedAt",stats.get("oldest"));r.put("latestObservedAt",stats.get("latest"));r.put("maxAgeMinutes",age);r.put("thresholdPercent",threshold);r.put("checkedAt",now());return r;
    }
    private void checkFreshness(long id,boolean automatic) {
        var f=freshnessPolicy(id);
        if(!automatic||!Boolean.parseBoolean(Objects.toString(f.get("enabled")))) {resolve(id,"source_stale","源报价时效、自动调度或接入已暂停，停止监测");return;}
        var r=freshness(id,f); long total=((Number)r.get("total")).longValue();
        long elapsed=Duration.between(LocalDateTime.parse(f.get("monitor_from").toString(),FORMAT),LocalDateTime.parse(now(),FORMAT)).toMinutes();
        boolean missing=total==0 && elapsed>=((Number)f.get("max_age_minutes")).intValue();
        if("expired".equals(r.get("state"))||missing) {
            String severity=total>0&&Objects.equals(r.get("total"),r.get("expired"))?"critical":"warning";
            String detail=missing?"监测宽限期已过，尚无在线报价观测样本":"源报价过期 "+r.get("expired")+" / "+total+"（"+r.get("expiredPercent")+"%）；最大年龄 "+r.get("maxAgeMinutes")+" 分钟；阈值 "+r.get("thresholdPercent")+"%；最旧 "+r.get("oldestObservedAt")+"；最新 "+r.get("latestObservedAt");
            var existing=jdbc.queryForList("SELECT id,severity FROM info_collect_alert WHERE task_id=? AND alert_type='source_stale' AND active_slot=1",id);
            if(existing.isEmpty()||("critical".equals(severity)&&!"critical".equals(existing.get(0).get("severity")))) trigger(id,"source_stale",severity,detail);
            else jdbc.update("UPDATE info_collect_alert SET detail=? WHERE id=?",detail,existing.get(0).get("id"));
        } else if(total>0) resolve(id,"source_stale","在线报价过期占比已低于阈值，源报价时效恢复");
    }
    private void trigger(long id,String type,String severity,String detail) {
        String text=detail.substring(0,Math.min(2000,detail.length())),time=now();
        var rows=jdbc.queryForList("SELECT id,severity FROM info_collect_alert WHERE task_id=? AND alert_type=? AND active_slot=1",id,type);
        if(rows.isEmpty()) jdbc.update("INSERT INTO info_collect_alert(task_id,alert_type,severity,status,active_slot,hit_count,first_at,last_at,detail) VALUES(?,?,?,'open',1,1,?,?,?)",id,type,severity,time,time,text);
        else {
            boolean escalated="critical".equals(severity)&&!"critical".equals(rows.get(0).get("severity"));
            jdbc.update("UPDATE info_collect_alert SET severity=CASE WHEN severity='critical' THEN severity ELSE ? END,hit_count=hit_count+1,last_at=?,detail=? WHERE id=?",severity,time,text,rows.get(0).get("id"));
            if(escalated) jdbc.update("UPDATE info_collect_alert SET status='open',ack_by=NULL,ack_note=NULL,ack_at=NULL WHERE id=?",rows.get(0).get("id"));
        }
    }
    private void resolve(long id,String type,String note) {jdbc.update("UPDATE info_collect_alert SET status='recovered',active_slot=NULL,recovered_at=?,recovery_note=? WHERE task_id=? AND alert_type=? AND active_slot=1",now(),note,id,type);}
    private void resolveAll(long id,String note) {for(String type:List.of("failure","rejection","stale","source_stale")) resolve(id,type,note);}
    private void audit(String operator,String action,long id,String detail) {jdbc.update("INSERT INTO info_audit_log(operator_name,action_name,target_name,detail) VALUES(?,?,?,?)",operator,action,"任务#"+id,detail);}
}
