package com.agri.platform.internal.uc;

import com.agri.shared.result.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

/** Fixed deployment targets only; protected by the existing /admin/uc platform operator filter. */
@RestController
@RequestMapping("/api/v1/admin/uc/health-monitor")
public class HealthMonitorController {
    private final Monitor monitor;
    public HealthMonitorController(Monitor monitor) { this.monitor = monitor; }
    @GetMapping public ApiResponse<Map<String,Object>> status() { return ApiResponse.ok(monitor.snapshot()); }

    @Component
    public static class Monitor {
        private static final Logger LOG = LoggerFactory.getLogger(Monitor.class);
        private final Environment env;
        private final ObjectMapper json;
        private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).followRedirects(HttpClient.Redirect.NEVER).build();
        private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor();
        private final ExecutorService workers = Executors.newFixedThreadPool(8);
        private volatile List<Map<String,Object>> services = List.of();
        private volatile String checkedAt = "";
        private final Deque<Map<String,Object>> events = new ArrayDeque<>();
        private final Map<String,String> previous = new HashMap<>();
        private static final String[][] TARGETS = {
            {"core","核心平台 / 统一认证","8093"},{"production","生产管理","8092"},
            {"trade","交易撮合","8089"},{"finance","供应链金融","8087"},
            {"master-data","主数据","8083"},{"iot","物联网","8091"},
            {"s2b2c","供销商城","8088"},{"service","农业综合服务","8094"},
            {"info","资讯服务","8096"},{"government","政府监管","8095"},
            {"ai","AI 服务",""},{"satellite-iot","物联网卫星",""},
            {"satellite-ai","AI 网关卫星",""},{"satellite-quote","行情推送卫星",""},
            {"gov-exchange","政务交换","8112"}
        };
        public Monitor(Environment env,ObjectMapper json) { this.env=env;this.json=json; }
        @PostConstruct public void start() { timer.scheduleWithFixedDelay(this::collect,5,30,TimeUnit.SECONDS); }
        @PreDestroy public void stop() { timer.shutdownNow();workers.shutdownNow(); }
        private void collect() {
            try {
                var jobs = new ArrayList<Callable<Map<String,Object>>>();
                for(var t:TARGETS) jobs.add(()->check(t));
                var results = new ArrayList<Map<String,Object>>();
                for(var f:workers.invokeAll(jobs)) results.add(f.get());
                synchronized(this) {
                    for(var row:results) {
                        String id=(String)row.get("id"), state=(String)row.get("status");
                        String old=previous.put(id,state);
                        if(!Objects.equals(old,state)) {
                            events.addFirst(Map.of("name",row.get("name"),"from",old==null?"首次检查":old,"to",state,"at",row.get("checkedAt")));
                            while(events.size()>100)events.removeLast();
                            LOG.info("HEALTH_MONITOR service={} from={} to={}",id,old,state);
                        }
                    }
                    services=List.copyOf(results);checkedAt=OffsetDateTime.now().toString();
                }
            } catch(InterruptedException e) { Thread.currentThread().interrupt(); }
            catch(Exception e) { LOG.error("Health monitor collection failed",e); }
        }
        private Map<String,Object> check(String[] t) {
            String base=env.getProperty("agri.health-monitor.targets."+t[0],t[2].isBlank()?"":"http://127.0.0.1:"+t[2]);
            var row=new LinkedHashMap<String,Object>();row.put("id",t[0]);row.put("name",t[1]);
            var probes=new ArrayList<Map<String,Object>>();String status="UP";
            if(base.isBlank())status="UNCONFIGURED";
            else for(String suffix:List.of("","/liveness","/readiness")) {
                var p=probe(base.replaceAll("/+$","")+"/actuator/health"+suffix);
                p.put("name",suffix.isEmpty()?"综合健康":suffix.equals("/liveness")?"存活":"就绪");probes.add(p);
                if(!"UP".equals(p.get("status"))) status="ATTENTION";
            }
            row.put("status",status);row.put("probes",probes);row.put("checkedAt",OffsetDateTime.now().toString());
            return row;
        }
        private Map<String,Object> probe(String url) {
            long start=System.nanoTime();String status="ERROR",message="探测失败";int code=0;
            try {
                var uri=URI.create(url);
                if(!Set.of("http","https").contains(uri.getScheme())||uri.getUserInfo()!=null)throw new IllegalArgumentException();
                var response=http.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(3)).GET().build(),HttpResponse.BodyHandlers.ofString());
                code=response.statusCode();
                if(code==404){status="MISSING";message="健康探针尚未部署或地址不匹配";}
                else if(code==401||code==403){status="DENIED";message="探针被鉴权拦截";}
                else {
                    String value=json.readTree(response.body()).path("status").asText("");
                    if(code==200&&value.equals("UP")){status="UP";message="正常";}
                    else if(value.equals("DOWN")||value.equals("OUT_OF_SERVICE")){status="DOWN";message="应用或依赖未就绪";}
                    else {status="INVALID";message="非标准健康响应（HTTP "+code+"）";}
                }
            }catch(HttpTimeoutException e){status="TIMEOUT";message="探测超时";}
            catch(java.io.IOException e){status="UNREACHABLE";message=code==0?"服务无法连接":"健康响应不可解析";}
            catch(InterruptedException e){Thread.currentThread().interrupt();message="探测中断";}
            catch(Exception e){message="探针配置或响应异常";}
            return new LinkedHashMap<>(Map.of("status",status,"message",message,"httpCode",code,"latencyMs",TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-start)));
        }
        public synchronized Map<String,Object> snapshot() {
            return Map.of("checkedAt",checkedAt,"intervalSeconds",30,"services",services,"events",new ArrayList<>(events));
        }
    }
}
