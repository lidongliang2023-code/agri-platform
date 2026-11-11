package com.agri.ai.service;

import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.*;
import java.util.function.LongSupplier;

/** 单实例、通道共享的熔断器。冷却后以真实请求做单次半开探测，不发送后台请求。 */
@Service
public class ModelCircuitBreaker {
    private static final class Entry {
        final ModelProviderSettings.Channel channel;
        final ModelProviderSettings.CircuitPolicy policy;
        String state="CLOSED", reason="", changedAt=Instant.now().toString();
        int failures; long epoch, until, trips, recoveries; String incidentId="";
        Entry(ModelProviderSettings.Channel channel, ModelProviderSettings.CircuitPolicy policy) { this.channel=channel;this.policy=policy; }
    }
    public static final class Ticket {
        private final Entry entry; private final long epoch; private final boolean allowed, probe;
        private final String state, reason;
        private Ticket(Entry e, boolean allowed, boolean probe, String state, String reason) {
            this.entry=e;this.epoch=e==null?0:e.epoch;this.allowed=allowed;this.probe=probe;this.state=state;this.reason=reason;
        }
        public boolean allowed() { return allowed; }
        public String state() { return state; }
        public String reason() { return reason; }
    }
    private final Map<String,Entry> entries=new HashMap<>();
    private final LongSupplier clock;
    private final ModelCircuitAlerts alerts;
    @org.springframework.beans.factory.annotation.Autowired
    public ModelCircuitBreaker(ModelCircuitAlerts alerts) { this(System::nanoTime,alerts); }
    ModelCircuitBreaker(LongSupplier clock) { this(clock,null); }
    ModelCircuitBreaker(LongSupplier clock,ModelCircuitAlerts alerts) { this.clock=clock;this.alerts=alerts; }
    private void notify(Entry e,String type) {
        if(alerts!=null) alerts.publish(e.channel,e.policy,e.incidentId,type,e.failures,e.reason);
    }
    private Entry entry(ModelProviderSettings.Channel c, ModelProviderSettings.CircuitPolicy p) {
        Entry e=entries.get(c.id());
        if(e==null || !e.channel.equals(c) || !e.policy.equals(p)) { e=new Entry(c,p);entries.put(c.id(),e); }
        return e;
    }
    public synchronized Ticket acquire(ModelProviderSettings.Channel c, ModelProviderSettings.CircuitPolicy p) {
        Entry e=entry(c,p);
        if(!p.enabled()) return new Ticket(null,true,false,"DISABLED","");
        if("CLOSED".equals(e.state)) return new Ticket(e,true,false,e.state,"");
        if("HALF_OPEN".equals(e.state)) return new Ticket(e,false,false,e.state,"熔断恢复探测中，跳过此通道");
        if(clock.getAsLong()<e.until) return new Ticket(e,false,false,e.state,"通道熔断冷却中，跳过此通道");
        e.state="HALF_OPEN";e.epoch++;e.changedAt=Instant.now().toString();
        return new Ticket(e,true,true,e.state,"");
    }
    private boolean valid(Ticket t) {
        return t.allowed && t.entry!=null && entries.get(t.entry.channel.id())==t.entry && t.entry.epoch==t.epoch;
    }
    public synchronized void success(Ticket t) {
        if(!valid(t)) return;
        Entry e=t.entry;
        if(t.probe) { e.recoveries++;e.epoch++;notify(e,"RECOVERED"); }
        e.state="CLOSED";e.failures=0;e.reason="";e.until=0;e.changedAt=Instant.now().toString();
    }
    public synchronized void failure(Ticket t, boolean counted, String reason) {
        if(!valid(t)) return;
        Entry e=t.entry;
        // 参数错误打断连续故障；半开时仍重新冷却，只有有效模型回复才能恢复。
        if(!counted && !t.probe) { e.failures=0;return; }
        if(counted) { e.failures++;e.reason=reason; }
        else e.reason="探测请求被拒绝，尚未确认模型恢复";
        if(t.probe || e.failures>=e.policy.failureThreshold()) {
            if(!t.probe)e.incidentId=UUID.randomUUID().toString();
            e.state="OPEN";e.epoch++;e.trips++;
            e.until=clock.getAsLong()+e.policy.cooldownSeconds()*1_000_000_000L;
            e.changedAt=Instant.now().toString();notify(e,t.probe?"REOPEN":"OPEN");
        }
    }
    public synchronized Map<String,Object> status(ModelProviderSettings.Channel c, ModelProviderSettings.CircuitPolicy p) {
        Entry e=entry(c,p);long remaining="OPEN".equals(e.state)?Math.max(0,(e.until-clock.getAsLong()+999_999)/1_000_000):0;
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("state",!p.enabled()?"DISABLED":"OPEN".equals(e.state)&&remaining==0?"PROBE_READY":e.state);
        out.put("consecutiveFailures",e.failures);out.put("remainingMs",remaining);out.put("tripCount",e.trips);
        out.put("recoveryCount",e.recoveries);out.put("lastReason",e.reason);out.put("changedAt",e.changedAt);
        return out;
    }
    public synchronized void requestProbe(ModelProviderSettings.Channel c, ModelProviderSettings.CircuitPolicy p) {
        Entry e=entry(c,p);
        if(!p.enabled()) throw new IllegalArgumentException("请先开启熔断恢复");
        if(!"OPEN".equals(e.state)) throw new org.springframework.web.server.ResponseStatusException(
            org.springframework.http.HttpStatus.CONFLICT,"仅熔断冷却中的通道可提前探测，请刷新运行状态");
        e.until=clock.getAsLong();e.epoch++;e.changedAt=Instant.now().toString();
    }
    public synchronized void forget(String id) { entries.remove(id); }
}
