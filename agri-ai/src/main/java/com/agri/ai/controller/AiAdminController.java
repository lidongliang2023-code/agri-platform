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
    private final ModelConnectionVerifier connectionVerifier;
    private final ModelCatalogService modelCatalog;
    private final ModelFailoverStatistics failoverStatistics;
    private final ModelCircuitAlerts circuitAlerts;
    public AiAdminController(AiSceneCatalog catalog, AiCallAudit audit, AiHubDispatcher dispatcher, AIConfig config, AiSceneManagement management, RealModelClient modelClient, ModelConnectionVerifier connectionVerifier, ModelCatalogService modelCatalog, ModelFailoverStatistics failoverStatistics, ModelCircuitAlerts circuitAlerts) {
        this.circuitAlerts=circuitAlerts;
        this.failoverStatistics=failoverStatistics;
        this.catalog=catalog;this.audit=audit;this.dispatcher=dispatcher;this.config=config;this.management=management;this.modelClient=modelClient;this.connectionVerifier=connectionVerifier;this.modelCatalog=modelCatalog;
    }
    private Map<String,Object> ok(Object data) { return Map.of("code",0,"data",data); }
    @GetMapping("/overview") public Map<String,Object> overview() {
        var records=audit.list(); long success=records.stream().filter(e -> "SUCCESS".equals(e.status())).count();
        Map<String,Object> data=new LinkedHashMap<>();
        data.put("status","UP");data.put("time",Instant.now().toString());
        data.put("uptimeMs",ManagementFactory.getRuntimeMXBean().getUptime());
        data.put("sceneCount",management.list().size());data.put("systemCount",management.list().stream().map(s->s.get("bizSystem")).distinct().count());
        data.put("callCount",records.size());data.put("successCount",success);
        data.put("averageLatencyMs",records.stream().mapToLong(AiCallAudit.Entry::latencyMs).average().orElse(0));
        data.put("auditWritable",audit.writable());data.put("recent",records.stream().limit(6).toList());
        data.put("provider",config.getProvider());data.put("mode","RULE_TEMPLATE");
        data.put("modelConfigured",modelClient.configured());
        return ok(data);
    }
    @GetMapping("/scenes") public Map<String,Object> scenes() { return ok(management.list()); }

    @PostMapping("/scenes") public Map<String,Object> createScene(@RequestBody AiSceneManagement.CreateScene edit,
            jakarta.servlet.http.HttpServletRequest request) {
        return ok(management.create(edit,operator(request)));
    }

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
    @PutMapping("/scenes/{code}/model") public Map<String,Object> sceneModel(@PathVariable String code,
            @RequestBody AiSceneManagement.ModelEdit edit, jakarta.servlet.http.HttpServletRequest request) {
        return ok(management.bindModel(code,edit,operator(request)));
    }
    @PutMapping("/scenes/models/batch") public Map<String,Object> batchSceneModels(
            @RequestBody AiSceneManagement.BatchModelEdit edit, jakarta.servlet.http.HttpServletRequest request) {
        return ok(management.bindModels(edit,operator(request)));
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
    @GetMapping("/failover/statistics") public Map<String,Object> failoverStatistics(
            @RequestParam(defaultValue="24") int hours, @RequestParam(defaultValue="") String provider,
            @RequestParam(defaultValue="ALL") String outcome, @RequestParam(defaultValue="1") int page,
            @RequestParam(defaultValue="15") int pageSize) {
        return ok(failoverStatistics.query(hours,provider,outcome,page,pageSize));
    }
    @GetMapping("/circuit-alerts/summary") public Map<String,Object> circuitAlertSummary(jakarta.servlet.http.HttpServletRequest request) {
        return ok(circuitAlerts.summary(operator(request)));
    }
    @GetMapping("/circuit-alerts") public Map<String,Object> circuitAlerts(
            @RequestParam(defaultValue="") String provider, @RequestParam(defaultValue="ALL") String type,
            @RequestParam(defaultValue="false") boolean unreadOnly, @RequestParam(defaultValue="1") int page,
            @RequestParam(defaultValue="15") int pageSize, jakarta.servlet.http.HttpServletRequest request) {
        return ok(circuitAlerts.query(operator(request),provider,type,unreadOnly,page,pageSize));
    }
    @PostMapping("/circuit-alerts/read") public Map<String,Object> readCircuitAlerts(
            @RequestBody ModelCircuitAlerts.ReadEdit edit, jakarta.servlet.http.HttpServletRequest request) {
        return ok(circuitAlerts.markRead(operator(request),edit));
    }
    @GetMapping("/providers") public Map<String,Object> providers() {
        return ok(connectionVerifier.providers());
    }
    @PostMapping("/providers/models") public Map<String,Object> providerModels(@RequestBody ModelCatalogService.Query query,
            jakarta.servlet.http.HttpServletRequest request) {
        return ok(modelCatalog.fetch(query,operator(request)));
    }
    @GetMapping("/providers/{id}/changes") public Map<String,Object> providerChanges(@PathVariable String id,
            @RequestParam(defaultValue="20") int limit) {
        if (limit < 1 || limit > 100) throw new IllegalArgumentException("变更记录条数必须在 1 到 100 之间");
        return ok(Map.of("records", connectionVerifier.changes(id, limit),
                "writable", connectionVerifier.changeAuditWritable()));
    }
    @PutMapping("/providers/{id}") public Map<String,Object> saveProvider(@PathVariable String id,
            @RequestBody ModelProviderSettings.Edit edit, jakarta.servlet.http.HttpServletRequest request) {
        return ok(connectionVerifier.save(id,edit,operator(request)));
    }
    @PutMapping("/providers/{id}/failover") public Map<String,Object> saveFailover(@PathVariable String id,
            @RequestBody ModelProviderSettings.FailoverEdit edit, jakarta.servlet.http.HttpServletRequest request) {
        return ok(connectionVerifier.saveFailover(id,edit,operator(request)));
    }
    @PutMapping("/providers/{id}/circuit") public Map<String,Object> saveCircuit(@PathVariable String id,
            @RequestBody ModelProviderSettings.CircuitEdit edit, jakarta.servlet.http.HttpServletRequest request) {
        return ok(connectionVerifier.saveCircuit(id,edit,operator(request)));
    }
    @PostMapping("/providers/{id}/circuit/probe") public Map<String,Object> probeCircuit(@PathVariable String id,
            @RequestBody ProviderSelection selection, jakarta.servlet.http.HttpServletRequest request) {
        return ok(connectionVerifier.requestCircuitProbe(id,selection.revision(),operator(request)));
    }
    public record ProviderSelection(Long revision) {}
    @PostMapping("/providers/{id}/select") public Map<String,Object> selectProvider(@PathVariable String id,
            @RequestBody ProviderSelection selection, jakarta.servlet.http.HttpServletRequest request) {
        return ok(connectionVerifier.switchTo(id,selection.revision(),operator(request)));
    }
    @PostMapping("/providers/{id}/test") public Map<String,Object> testProvider(@PathVariable String id) {
        return ok(connectionVerifier.test(id));
    }
    @PostMapping("/providers") public Map<String,Object> createProvider(@RequestBody ModelProviderSettings.Edit edit,
            jakarta.servlet.http.HttpServletRequest request) {
        return ok(connectionVerifier.create(edit,operator(request)));
    }
    @DeleteMapping("/providers/{id}") public Map<String,Object> deleteProvider(@PathVariable String id,
            @RequestParam long revision, jakarta.servlet.http.HttpServletRequest request) {
        connectionVerifier.delete(id,revision,operator(request)); return ok(Map.of("deleted",true));
    }
    @PostMapping("/debug") public Map<String,Object> debug(@RequestBody AiInvokeRequest req) {
        var scene=management.metadata(req.getSceneCode());
        req.setBizSystem(scene.bizSystem());
        if(req.getInput()==null || req.getInput().size()>50 || req.getInput().toString().length()>16000)
            throw new IllegalArgumentException("请提供不超过16KB、50个字段的JSON对象");
        if(req.getBizId()!=null && req.getBizId().length()>100) throw new IllegalArgumentException("业务编号过长");
        return ok(dispatcher.dispatch(req));
    }
}
