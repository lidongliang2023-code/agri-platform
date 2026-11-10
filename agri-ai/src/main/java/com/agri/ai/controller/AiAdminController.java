package com.agri.ai.controller;
import com.agri.ai.config.AIConfig;
import com.agri.ai.service.*;
import com.agri.common.ai.dto.*;
import org.springframework.web.bind.annotation.*;
import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/ai/admin")
public class AiAdminController {
    private final AiSceneCatalog catalog; private final AiCallAudit audit;
    private final AiHubDispatcher dispatcher; private final AIConfig config; private final AiSceneManagement management;
    private final RealModelClient modelClient;
    public AiAdminController(AiSceneCatalog catalog, AiCallAudit audit, AiHubDispatcher dispatcher, AIConfig config, AiSceneManagement management, RealModelClient modelClient) {
        this.catalog=catalog;this.audit=audit;this.dispatcher=dispatcher;this.config=config;this.management=management;this.modelClient=modelClient;
    }
    private Map<String,Object> ok(Object data) { return Map.of("code",0,"data",data); }
    @GetMapping("/overview") public Map<String,Object> overview() {
        var records=audit.list(); long success=records.stream().filter(e -> "SUCCESS".equals(e.status())).count();
        Map<String,Object> data=new LinkedHashMap<>();
        data.put("status","UP");data.put("time",Instant.now().toString());
        data.put("uptimeMs",ManagementFactory.getRuntimeMXBean().getUptime());
        data.put("sceneCount",catalog.list().size());data.put("systemCount",8);
        data.put("callCount",records.size());data.put("successCount",success);
        data.put("averageLatencyMs",records.stream().mapToLong(AiCallAudit.Entry::latencyMs).average().orElse(0));
        data.put("auditWritable",audit.writable());data.put("recent",records.stream().limit(6).toList());
        data.put("provider",config.getProvider());data.put("mode","RULE_TEMPLATE");
        data.put("modelConfigured",configured(selectedKey()));
        return ok(data);
    }
    @GetMapping("/scenes") public Map<String,Object> scenes() { return ok(management.list()); }

    private String operator(jakarta.servlet.http.HttpServletRequest request) {
        Object operator=request.getAttribute("ai.operator");
        if(operator==null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED,"统一身份未核验");
        return String.valueOf(operator);
    }
    @GetMapping("/scenes/{code}") public Map<String,Object> scene(@PathVariable String code) { return ok(management.detail(code)); }
    @PutMapping("/scenes/{code}") public Map<String,Object> editScene(@PathVariable String code,
            @RequestBody AiSceneManagement.SceneEdit edit, jakarta.servlet.http.HttpServletRequest request) {
        return ok(management.edit(code,edit,operator(request)));
    }
    @PostMapping("/scenes/{code}/versions") public Map<String,Object> draft(@PathVariable String code,
            @RequestBody AiSceneManagement.DraftEdit edit, jakarta.servlet.http.HttpServletRequest request) {
        return ok(management.draft(code,edit,operator(request)));
    }
    @PostMapping("/scenes/{code}/publish") public Map<String,Object> publish(@PathVariable String code,
            @RequestBody AiSceneManagement.VersionAction edit, jakarta.servlet.http.HttpServletRequest request) {
        return ok(management.activate(code,edit,operator(request),false));
    }
    @PostMapping("/scenes/{code}/rollback") public Map<String,Object> rollback(@PathVariable String code,
            @RequestBody AiSceneManagement.VersionAction edit, jakarta.servlet.http.HttpServletRequest request) {
        return ok(management.activate(code,edit,operator(request),true));
    }
    @PostMapping("/scenes/{code}/preview") public Map<String,Object> preview(@PathVariable String code,
            @RequestBody AiSceneManagement.Preview preview) { return ok(management.preview(code,preview)); }
    @GetMapping("/calls") public Map<String,Object> calls(@RequestParam(defaultValue="") String keyword,
            @RequestParam(defaultValue="") String status, @RequestParam(defaultValue="1") int page,
            @RequestParam(defaultValue="15") int pageSize) {
        if(page<1 || pageSize<1 || pageSize>100 || keyword.length()>100) throw new IllegalArgumentException("分页或检索参数不正确");
        var all=audit.list().stream().filter(e -> status.isBlank() || e.status().equals(status))
            .filter(e -> keyword.isBlank() || (e.taskId()+e.sceneCode()+e.bizSystem()+e.traceId()).toLowerCase(Locale.ROOT).contains(keyword.toLowerCase(Locale.ROOT))).toList();
        long offset=(long)(page-1)*pageSize;
        return ok(Map.of("total",all.size(),"records",all.stream().skip(offset).limit(pageSize).toList(),"page",page,"pageSize",pageSize));
    }
    @GetMapping("/providers") public Map<String,Object> providers() {
        return ok(List.of(provider("tongyi","服务通道 A",config.getTongyi().getApiKey()),
                provider("openai","服务通道 B",config.getOpenai().getApiKey())));
    }
    private Map<String,Object> provider(String id,String name,String key) {
        return Map.of("id",id,"name",name,"selected",id.equalsIgnoreCase(config.getProvider()),
            "configured",configured(key),"connectionTested",false);
    }
    private String selectedKey() { return "openai".equalsIgnoreCase(config.getProvider()) ? config.getOpenai().getApiKey() : config.getTongyi().getApiKey(); }
    private boolean configured(String key) { return key!=null && !key.isBlank() && !key.equals("your-api-key"); }
    @PostMapping("/debug") public Map<String,Object> debug(@RequestBody AiInvokeRequest req) {
        var scene=catalog.require(req.getSceneCode());
        req.setBizSystem(scene.bizSystem());
        if(req.getInput()==null || req.getInput().size()>50 || req.getInput().toString().length()>16000)
            throw new IllegalArgumentException("请提供不超过16KB、50个字段的JSON对象");
        if(req.getBizId()!=null && req.getBizId().length()>100) throw new IllegalArgumentException("业务编号过长");
        return ok(dispatcher.dispatch(req));
    }
}
