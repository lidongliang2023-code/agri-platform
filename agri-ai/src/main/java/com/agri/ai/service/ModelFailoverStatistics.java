package com.agri.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.nio.file.*;
import java.time.*;
import java.util.*;

/** 真实模型路由统计，仅保存通道与结果元数据，不保存输入、输出、地址或凭据。 */
@Service
public class ModelFailoverStatistics {
    private static final int CAPACITY=10000;
    public record Attempt(String provider, String name, String model, String status, String reason,
                          Integer httpStatus, long latencyMs) {}
    public record Entry(String id, String time, String primaryProvider, String primaryName,
                        String sceneCode, boolean failoverEnabled, boolean success, boolean switched,
                        String actualProvider, long latencyMs, List<Attempt> attempts) {}
    private final Deque<Entry> entries=new ArrayDeque<>();
    private final ObjectMapper json;
    private final Path file;
    private final Clock clock;
    private boolean writable=true;
    private int diskEntries;
    private final String collectingSince;

    @org.springframework.beans.factory.annotation.Autowired
    public ModelFailoverStatistics(ObjectMapper json,
            @Value("${ai.admin.failover-statistics-file:${user.home}/.agri-platform/ai-models/failover-statistics.jsonl}") String file) {
        this(json,file,Clock.systemDefaultZone());
    }
    ModelFailoverStatistics(ObjectMapper json,String file,Clock clock) {
        this.json=json;this.file=Path.of(file).toAbsolutePath();this.clock=clock;
        collectingSince=clock.instant().toString();
        if(Files.exists(this.file)) {
            try(var lines=Files.lines(this.file)) {
                lines.forEach(line->{try {
                    Entry e=json.readValue(line,Entry.class);
                    Instant.parse(e.time());
                    if(e.attempts()==null||e.attempts().size()>4||e.id()==null) return;
                    entries.addLast(e);diskEntries++;if(entries.size()>CAPACITY)entries.removeFirst();
                } catch(Exception ignored) {}});
            } catch(Exception e) {writable=false;}
        }
    }
    public synchronized void record(ModelProviderSettings.Channel primary, String sceneCode, boolean enabled,
                                    List<Map<String,Object>> raw, boolean success, long latencyMs) {
        List<Attempt> attempts=new ArrayList<>();
        for(var item:raw) {
            String status=Objects.toString(item.get("status"),"FAILED");
            Integer http=item.get("http_status") instanceof Number n?n.intValue():null;
            // 原始异常不落盘；故障类别由本地固定枚举归一化。
            String reason="SUCCESS".equals(status)?"":"SKIPPED".equals(status)?"熔断跳过":
                http!=null?"上游 HTTP "+http:Objects.toString(item.get("reason"),"").contains("配置")?"配置不完整":
                Objects.toString(item.get("reason"),"").contains("网络")?"网络连接失败或请求超时":"响应格式异常或内容为空";
            attempts.add(new Attempt(Objects.toString(item.get("provider"),""),Objects.toString(item.get("provider_name"),""),
                Objects.toString(item.get("model"),""),status,reason,http,
                item.get("latency_ms") instanceof Number n?Math.max(0,n.longValue()):0));
        }
        String actual=attempts.stream().filter(a->"SUCCESS".equals(a.status())).map(Attempt::provider).findFirst().orElse("");
        Entry entry=new Entry(UUID.randomUUID().toString(),clock.instant().toString(),primary.id(),primary.name(),
            sceneCode==null?"":sceneCode,enabled,success,attempts.size()>1,actual,Math.max(0,latencyMs),List.copyOf(attempts));
        entries.addLast(entry);if(entries.size()>CAPACITY)entries.removeFirst();
        try {
            Files.createDirectories(file.getParent());
            if(diskEntries>=CAPACITY+500) {
                Path temp=file.resolveSibling(file.getFileName()+".tmp");
                StringBuilder content=new StringBuilder();for(var e:entries)content.append(json.writeValueAsString(e)).append('\n');
                Files.writeString(temp,content);
                try {Files.move(temp,file,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);}
                catch(AtomicMoveNotSupportedException ex){Files.move(temp,file,StandardCopyOption.REPLACE_EXISTING);}
                diskEntries=entries.size();
            } else {Files.writeString(file,json.writeValueAsString(entry)+"\n",StandardOpenOption.CREATE,StandardOpenOption.APPEND);diskEntries++;}
            writable=true;
        } catch(Exception e) {writable=false;}
    }
    private static long count(List<Entry> list,java.util.function.Predicate<Entry> test){return list.stream().filter(test).count();}
    private static Double rate(long n,long d){return d==0?null:Math.round(1000.0*n/d)/10.0;}
    private static Map<String,Object> summary(List<Entry> list) {
        long total=list.size(),success=count(list,Entry::success),switched=count(list,Entry::switched),rescued=count(list,e->e.switched()&&e.success());
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("total",total);out.put("success",success);out.put("failed",total-success);
        out.put("primarySuccess",count(list,e->e.success()&&!e.switched()));out.put("switched",switched);
        out.put("rescued",rescued);out.put("switchFailed",switched-rescued);
        out.put("successRate",rate(success,total));out.put("switchSuccessRate",rate(rescued,switched));
        out.put("switchRate",rate(switched,total));
        out.put("policyEnabled",count(list,Entry::failoverEnabled));
        out.put("skipped",list.stream().flatMap(e->e.attempts().stream()).filter(a->"SKIPPED".equals(a.status())).count());
        out.put("averageLatencyMs",list.stream().mapToLong(Entry::latencyMs).average().orElse(0));
        out.put("switchAverageLatencyMs",list.stream().filter(Entry::switched).mapToLong(Entry::latencyMs).average().orElse(0));
        return out;
    }
    public synchronized Map<String,Object> query(int hours,String provider,String outcome,int page,int pageSize) {
        if(!Set.of(0,1,24,168,720).contains(hours)||provider==null||provider.length()>100||outcome==null||
            !Set.of("ALL","SWITCHED","FAILED","PRIMARY").contains(outcome)||page<1||pageSize<1||pageSize>100)
            throw new IllegalArgumentException("统计筛选或分页参数不正确");
        Instant now=clock.instant(),since=hours==0?Instant.MIN:now.minusSeconds(hours*3600L);
        List<Entry> list=entries.stream().filter(e->{Instant t=Instant.parse(e.time());return !t.isBefore(since)&&!t.isAfter(now);})
            .filter(e->provider.isEmpty()||provider.equals(e.primaryProvider()))
            .filter(e->switch(outcome){case "SWITCHED"->e.switched();case "FAILED"->!e.success();case "PRIMARY"->e.success()&&!e.switched();default->true;}).toList();
        Map<String,Object> out=new LinkedHashMap<>(summary(list));
        out.put("hours",hours);out.put("provider",provider);out.put("outcome",outcome);
        out.put("writable",writable);out.put("capacity",CAPACITY);out.put("retained",entries.size());
        out.put("oldestRetainedAt",entries.isEmpty()?"":entries.getFirst().time());out.put("collectingSince",collectingSince);
        out.put("generatedAt",now.toString());out.put("zone",clock.getZone().getId());
        var options=new LinkedHashMap<String,String>();for(var e:entries)options.put(e.primaryProvider(),e.primaryName());
        out.put("providers",options.entrySet().stream().map(e->Map.of("id",e.getKey(),"name",e.getValue())).toList());
        var channels=new LinkedHashMap<String,Map<String,Object>>();var reasons=new TreeMap<String,Long>();
        for(var e:list) for(var a:e.attempts()) {
            var row=channels.computeIfAbsent(a.provider(),id->{var r=new LinkedHashMap<String,Object>();r.put("id",id);r.put("name",a.name());r.put("success",0L);r.put("failed",0L);r.put("skipped",0L);r.put("takeovers",0L);r.put("latencyTotal",0L);return r;});
            row.put("name",a.name());String key="SUCCESS".equals(a.status())?"success":"SKIPPED".equals(a.status())?"skipped":"failed";
            row.put(key,(long)row.get(key)+1);
            if(!"SKIPPED".equals(a.status()))row.put("latencyTotal",(long)row.get("latencyTotal")+a.latencyMs());
            if("SUCCESS".equals(a.status())&&!a.provider().equals(e.primaryProvider()))row.put("takeovers",(long)row.get("takeovers")+1);
            if(!a.reason().isEmpty())reasons.merge(a.reason(),1L,Long::sum);
        }
        for(var row:channels.values()) {long n=(long)row.get("success")+(long)row.get("failed");row.put("requests",n);row.put("successRate",rate((long)row.get("success"),n));row.put("averageLatencyMs",n==0?0:(double)(long)row.remove("latencyTotal")/n);row.remove("latencyTotal");}
        out.put("channels",new ArrayList<>(channels.values()));
        out.put("reasons",reasons.entrySet().stream().sorted(Map.Entry.<String,Long>comparingByValue().reversed()).map(e->Map.of("reason",e.getKey(),"count",e.getValue())).toList());
        boolean hourly=hours>0&&hours<=24;var trend=new TreeMap<String,List<Entry>>();
        var format=java.time.format.DateTimeFormatter.ofPattern(hourly?"MM-dd HH:00":"yyyy-MM-dd");
        if(hours>0) {int buckets=hourly?hours:hours/24;var end=now.atZone(clock.getZone());for(int i=buckets-1;i>=0;i--)trend.put(format.format(hourly?end.minusHours(i):end.minusDays(i)),new ArrayList<>());}
        for(var e:list)trend.computeIfAbsent(format.format(Instant.parse(e.time()).atZone(clock.getZone())),k->new ArrayList<>()).add(e);
        out.put("trend",trend.entrySet().stream().map(e->{var r=summary(e.getValue());r.put("time",e.getKey());return r;}).toList());
        var reversed=new ArrayList<>(list);Collections.reverse(reversed);
        out.put("records",reversed.stream().skip((long)(page-1)*pageSize).limit(pageSize).toList());out.put("page",page);out.put("pageSize",pageSize);
        return out;
    }
}
