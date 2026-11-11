package com.agri.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;

/** 熔断状态转换的站内通知；不存凭据、地址、业务正文或上游原始异常。 */
@Service
public class ModelCircuitAlerts {
    private static final int CAPACITY=1000;
    public record Entry(String id, String incidentId, String time, String providerId, String providerName,
                        String model, String type, String severity, String title, String reason,
                        int failures, int threshold, int cooldownSeconds) {}
    public record Snapshot(List<Entry> entries, Map<String,Set<String>> readers) {}
    public record ReadEdit(List<String> ids, String throughId) {}
    private final ObjectMapper json;
    private final Path file;
    private final Deque<Entry> entries=new ArrayDeque<>();
    private Map<String,Set<String>> readers=new LinkedHashMap<>();
    private boolean writable=true;

    public ModelCircuitAlerts(ObjectMapper json,
            @Value("${ai.admin.circuit-alerts-file:${user.home}/.agri-platform/ai-models/circuit-alerts.json}") String file) {
        this.json=json;this.file=Path.of(file).toAbsolutePath();
        if(Files.exists(this.file)) try {
            Snapshot snapshot=json.readValue(Files.readString(this.file),Snapshot.class);
            if(snapshot.entries()!=null) for(Entry e:snapshot.entries()) {
                if(e.id()==null||e.incidentId()==null||!Set.of("OPEN","REOPEN","RECOVERED").contains(e.type())) continue;
                Instant.parse(e.time());entries.addLast(e);if(entries.size()>CAPACITY)entries.removeFirst();
            }
            if(snapshot.readers()!=null) snapshot.readers().forEach((key,value)->readers.put(key,new HashSet<>(value)));
            prune(readers);
        } catch(Exception e) {writable=false;}
    }
    private String reason(String raw) {
        if(raw==null) return "模型调用故障";
        if(raw.matches("上游 HTTP \\d{3}")) return raw;
        if(raw.contains("配置")) return "配置不完整";
        if(raw.contains("网络")||raw.contains("超时")) return "网络连接失败或请求超时";
        if(raw.contains("探测请求被拒绝")) return "探测请求被拒绝，尚未确认模型恢复";
        return "模型响应格式异常或内容为空";
    }
    public synchronized void publish(ModelProviderSettings.Channel channel, ModelProviderSettings.CircuitPolicy policy,
            String incidentId, String type, int failures, String rawReason) {
        if(!Set.of("OPEN","REOPEN","RECOVERED").contains(type)) throw new IllegalArgumentException("不支持的告警事件");
        String title=switch(type){case "OPEN"->"模型通道已熔断";case "REOPEN"->"模型恢复探测失败";default->"模型通道已恢复";};
        entries.addLast(new Entry(UUID.randomUUID().toString(),incidentId,Instant.now().toString(),channel.id(),channel.name(),
            channel.model(),type,"RECOVERED".equals(type)?"INFO":"WARNING",title,"RECOVERED".equals(type)?"有效模型回复，恢复正常调用":reason(rawReason),
            failures,policy.failureThreshold(),policy.cooldownSeconds()));
        if(entries.size()>CAPACITY)entries.removeFirst();prune(readers);
        try {persist(readers);writable=true;} catch(Exception e) {writable=false;}
    }
    private void prune(Map<String,Set<String>> data) {
        Set<String> retained=new HashSet<>();for(var e:entries)retained.add(e.id());
        data.values().forEach(ids->ids.retainAll(retained));data.entrySet().removeIf(e->e.getValue().isEmpty());
    }
    private void persist(Map<String,Set<String>> data) throws Exception {
        Files.createDirectories(file.getParent());Path temp=file.resolveSibling(file.getFileName()+".tmp");
        Files.writeString(temp,json.writeValueAsString(new Snapshot(List.copyOf(entries),data)));
        try {Files.move(temp,file,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);}
        catch(AtomicMoveNotSupportedException e){Files.move(temp,file,StandardCopyOption.REPLACE_EXISTING);}
    }
    public synchronized Map<String,Object> summary(String operator) {
        var read=readers.getOrDefault(operator,Set.of());
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("unreadCount",entries.stream().filter(e->!read.contains(e.id())).count());
        out.put("retained",entries.size());out.put("capacity",CAPACITY);out.put("writable",writable);
        out.put("latestId",entries.isEmpty()?"":entries.getLast().id());
        return out;
    }
    public synchronized Map<String,Object> query(String operator,String provider,String type,boolean unreadOnly,int page,int pageSize) {
        if(provider==null||provider.length()>100||type==null||!Set.of("ALL","OPEN","REOPEN","RECOVERED").contains(type)||page<1||pageSize<1||pageSize>100)
            throw new IllegalArgumentException("通知筛选或分页参数不正确");
        var read=readers.getOrDefault(operator,Set.of());var all=new ArrayList<>(entries);Collections.reverse(all);
        var list=all.stream().filter(e->provider.isEmpty()||provider.equals(e.providerId()))
            .filter(e->"ALL".equals(type)||type.equals(e.type())).filter(e->!unreadOnly||!read.contains(e.id())).toList();
        List<Map<String,Object>> records=new ArrayList<>();
        for(var e:list.stream().skip((long)(page-1)*pageSize).limit(pageSize).toList()) {
            Map<String,Object> row=new LinkedHashMap<>();row.put("event",e);row.put("read",read.contains(e.id()));records.add(row);
        }
        var options=new LinkedHashMap<String,String>();for(var e:entries)options.put(e.providerId(),e.providerName());
        Map<String,Object> out=new LinkedHashMap<>(summary(operator));out.put("total",list.size());out.put("records",records);
        out.put("providers",options.entrySet().stream().map(e->Map.of("id",e.getKey(),"name",e.getValue())).toList());
        out.put("page",page);out.put("pageSize",pageSize);return out;
    }
    public synchronized Map<String,Object> markRead(String operator,ReadEdit edit) {
        if(edit==null||edit.ids()==null||edit.ids().size()>CAPACITY||edit.ids().stream().anyMatch(Objects::isNull)||
            edit.throughId()!=null&&edit.throughId().length()>100||!edit.ids().isEmpty()&&edit.throughId()!=null&&!edit.throughId().isEmpty())
            throw new IllegalArgumentException("请提供有效的通知编号或全部已读快照");
        Set<String> retained=new HashSet<>();for(var e:entries)retained.add(e.id());
        Set<String> chosen=new HashSet<>(edit.ids());
        if(!retained.containsAll(chosen)) throw new ResponseStatusException(HttpStatus.CONFLICT,"通知已轮转，请刷新后重试");
        if(edit.throughId()!=null&&!edit.throughId().isEmpty()) {
            if(!retained.contains(edit.throughId())) throw new ResponseStatusException(HttpStatus.CONFLICT,"通知快照已过期，请刷新后重试");
            for(var e:entries){chosen.add(e.id());if(e.id().equals(edit.throughId()))break;}
        }
        Map<String,Set<String>> next=new LinkedHashMap<>();readers.forEach((key,value)->next.put(key,new HashSet<>(value)));
        if(!chosen.isEmpty())next.computeIfAbsent(operator,k->new HashSet<>()).addAll(chosen);
        prune(next);
        try {persist(next);readers=next;writable=true;}
        catch(Exception e){writable=false;throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"已读状态保存失败，请稍后重试");}
        return summary(operator);
    }
}
