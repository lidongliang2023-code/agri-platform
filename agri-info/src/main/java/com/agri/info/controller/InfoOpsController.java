package com.agri.info.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.common.result.ApiResponse;
import com.agri.info.integration.SupplyDemandService;
import com.agri.info.media.MediaStorageService;
import com.agri.info.repository.InfoOpsRepository;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * 信息资讯 · 运营端接口。
 *
 * <p>准入：平台统一令牌 + {@code info:admin} 权限（与综合服务运营端同一套 RBAC 机制）。
 * 所有写操作都会落审计日志，操作人取自 {@code X-Agri-User} 头（统一账号昵称）。</p>
 */
@RestController
@RequestMapping("/api/v1/info/ops")
@OperatorOnly("info:admin")
public class InfoOpsController {

    private final com.agri.info.integration.QuoteCollectionService collection;
    private final com.agri.info.integration.QuoteCollectionScheduler scheduler;
    private final com.agri.info.integration.QuoteCollectionAlertService collectionAlerts;
    private final InfoOpsRepository repository;
    private final MediaStorageService mediaStorage;
    private final SupplyDemandService supplyDemandService;

    public InfoOpsController(InfoOpsRepository repository, MediaStorageService mediaStorage,
                             SupplyDemandService supplyDemandService, com.agri.info.integration.QuoteCollectionService collection,
                             com.agri.info.integration.QuoteCollectionScheduler scheduler,
                             com.agri.info.integration.QuoteCollectionAlertService collectionAlerts) {
        this.collectionAlerts = collectionAlerts;
        this.scheduler = scheduler;
        this.collection = collection;
        this.repository = repository;
        this.mediaStorage = mediaStorage;
        this.supplyDemandService = supplyDemandService;
    }

    private String operator(String header) {
        if (header == null || header.isBlank()) {
            return "平台运营";
        }
        try {
            return java.net.URLDecoder.decode(header.trim(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ignored) {
            return header.trim();
        }
    }

    // ---------- 大盘 ----------

    @GetMapping("/dashboard")
    public ApiResponse<Map<String, Object>> dashboard() {
        Map<String, Object> result = repository.dashboard();
        // 「在线供需信息」这张卡必须用交易模块的实时数：info 本地已无供需表
        Map<String, Object> counts = supplyDemandService.counts();
        if (result.get("cards") instanceof List<?> raw) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> cards = (List<Map<String, Object>>) raw;
            Map<String, Object> card = new java.util.LinkedHashMap<>();
            card.put("label", "在线供需信息");
            card.put("value", String.valueOf(counts.get("online")));
            card.put("unit", "条");
            card.put("note", "供应 " + counts.get("supply") + " · 需求 " + counts.get("demand"));
            card.put("tone", "flat");
            // 位置固定在「今日总阅读量 PV」之后，保持大盘卡片的既有阅读顺序
            cards.add(Math.min(2, cards.size()), card);
        }
        return ApiResponse.success(result);
    }

    // ---------- 内容 ----------

    @GetMapping("/contents")
    public ApiResponse<Map<String, Object>> contents(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String contentType,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(repository.contents(status, contentType, channel, keyword));
    }

    @GetMapping("/contents/{id}")
    public ApiResponse<Map<String, Object>> content(@PathVariable long id) {
        return ApiResponse.success(repository.contentDetail(id));
    }

    @PostMapping("/contents")
    public ApiResponse<Map<String, Object>> saveContent(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.saveContent(body, operator(user)));
    }

    @PostMapping("/contents/{id}/audit")
    public ApiResponse<Map<String, Object>> auditContent(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.auditContent(id, body, operator(user)));
    }

    @PostMapping("/contents/{id}/offline")
    public ApiResponse<Map<String, Object>> offlineContent(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.offlineContent(id, body, operator(user)));
    }

    // ---------- 栏目与作者 ----------

    @GetMapping("/channels")
    public ApiResponse<Map<String, Object>> channels() {
        return ApiResponse.success(repository.channelsAdmin());
    }

    @PostMapping("/channels")
    public ApiResponse<Map<String, Object>> saveChannel(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.saveChannel(body, operator(user)));
    }

    @PatchMapping("/authors/{id}")
    public ApiResponse<Map<String, Object>> updateAuthor(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.updateAuthor(id, body, operator(user)));
    }

    // ---------- 行情运营 ----------

    @GetMapping("/quotes")
    public ApiResponse<Map<String, Object>> quotes() {
        return ApiResponse.success(repository.quotesAdmin());
    }

    @PostMapping("/quotes")
    public ApiResponse<Map<String, Object>> saveQuote(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.saveQuote(body, operator(user)));
    }

    @PostMapping("/collect-tasks/{id}/run")
    public ApiResponse<Map<String, Object>> runTask(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(collection.run(id, operator(user)));
    }

    @GetMapping("/collect-tasks/{id}/config")
    public ApiResponse<Map<String, Object>> collectionConfig(@PathVariable long id) {
        return ApiResponse.success(collection.config(id));
    }

    @PostMapping("/collect-tasks/{id}/config")
    public ApiResponse<Map<String, Object>> saveCollectionConfig(@PathVariable long id,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(collection.saveConfig(id, body, operator(user)));
    }

    @GetMapping("/collect-tasks/{id}/schedule")
    public ApiResponse<Map<String,Object>> collectionSchedule(@PathVariable long id) {
        return ApiResponse.success(scheduler.config(id));
    }

    @PostMapping("/collect-tasks/{id}/schedule")
    public ApiResponse<Map<String,Object>> saveCollectionSchedule(@PathVariable long id,
            @RequestBody Map<String,Object> body,
            @RequestHeader(value="X-Agri-User", required=false) String user) {
        return ApiResponse.success(scheduler.save(id,body,operator(user)));
    }

    @GetMapping("/collect-tasks/{id}/runs")
    public ApiResponse<List<Map<String, Object>>> collectionRuns(@PathVariable long id) {
        return ApiResponse.success(collection.runs(id));
    }

    @GetMapping("/collection-alerts")
    public ApiResponse<Map<String,Object>> collectionAlerts(@RequestParam(defaultValue="active") String status,
            @RequestParam(required=false) Long taskId) {
        return ApiResponse.success(collectionAlerts.list(status,taskId));
    }

    @GetMapping("/collect-tasks/{id}/alert-policy")
    public ApiResponse<Map<String,Object>> collectionAlertPolicy(@PathVariable long id) {
        return ApiResponse.success(collectionAlerts.config(id));
    }

    @PostMapping("/collect-tasks/{id}/alert-policy")
    public ApiResponse<Map<String,Object>> saveCollectionAlertPolicy(@PathVariable long id,
            @RequestBody Map<String,Object> body,
            @RequestHeader(value="X-Agri-User",required=false) String user) {
        return ApiResponse.success(collectionAlerts.save(id,body,operator(user)));
    }

    @PostMapping("/collection-alerts/{id}/acknowledge")
    public ApiResponse<Map<String,Object>> acknowledgeCollectionAlert(@PathVariable long id,
            @RequestBody Map<String,Object> body,
            @RequestHeader(value="X-Agri-User",required=false) String user) {
        return ApiResponse.success(collectionAlerts.acknowledge(id,java.util.Objects.toString(body.get("note"),""),operator(user)));
    }

    @GetMapping("/quality")
    public ApiResponse<Map<String, Object>> quality() {
        return ApiResponse.success(repository.quality());
    }

    @GetMapping("/alert-rules")
    public ApiResponse<Map<String, Object>> alertRules() {
        return ApiResponse.success(repository.quotesAdmin());
    }

    @PostMapping("/alert-rules")
    public ApiResponse<Map<String, Object>> saveAlertRule(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.saveAlertRule(body, operator(user)));
    }

    @GetMapping("/forecast-config")
    public ApiResponse<Map<String, Object>> forecastConfig() {
        return ApiResponse.success(repository.forecastConfig("平台运营", Map.of()));
    }

    @PostMapping("/forecast-config")
    public ApiResponse<Map<String, Object>> saveForecastConfig(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("预测配置已更新",
                repository.forecastConfig(operator(user), body));
    }

    // ---------- 供需审核 ----------

    /**
     * 供需审核列表：直接读交易撮合的商品与采购需求。
     *
     * <p>原先读的是 {@code info_supply_demand}，用户端早就不写那张表了，
     * 运营看到的"待审核"全是演示数据，审了也不影响用户端 —— 审核台形同虚设。</p>
     */
    @GetMapping("/supply-demands")
    public ApiResponse<Map<String, Object>> supplyDemands(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ApiResponse.success(supplyDemandService.adminList(status, keyword, authorization));
    }

    @PostMapping("/supply-demands/{id}/audit")
    public ApiResponse<Map<String, Object>> auditSupplyDemand(
            @PathVariable long id,
            @RequestParam(required = false) String type,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(
                supplyDemandService.adminAudit(id, type, body, authorization, operator(user)));
    }

    // ---------- 推荐 / 敏感词 ----------

    @GetMapping("/recommend")
    public ApiResponse<Map<String, Object>> recommend() {
        return ApiResponse.success(repository.recommendAdmin());
    }

    @PostMapping("/recommend/slots/{id}")
    public ApiResponse<Map<String, Object>> saveSlot(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.saveSlot(id, body, operator(user)));
    }

    /** 某推荐位已编排的内容（有序）。 */
    @GetMapping("/recommend/slots/{id}/items")
    public ApiResponse<List<Map<String, Object>>> recommendItems(@PathVariable long id) {
        return ApiResponse.success(repository.recommendItems(id));
    }

    /** 整体替换推荐位内容，顺序即门户展示顺序。 */
    @PostMapping("/recommend/slots/{id}/items")
    public ApiResponse<Map<String, Object>> saveRecommendItems(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.saveRecommendItems(id, body, operator(user)));
    }

    @PostMapping("/sensitive-words")
    public ApiResponse<Map<String, Object>> saveSensitiveWord(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.saveSensitiveWord(body, operator(user)));
    }

    // ---------- AI 知识库 ----------

    @GetMapping("/ai")
    public ApiResponse<Map<String, Object>> ai(@RequestParam(required = false) String keyword) {
        return ApiResponse.success(repository.aiAdmin(keyword));
    }

    @PostMapping("/ai/knowledge")
    public ApiResponse<Map<String, Object>> saveKnowledge(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.saveKnowledge(body, operator(user)));
    }

    // ---------- 报告 / 存证 / 专家 ----------

    @GetMapping("/reports")
    public ApiResponse<Map<String, Object>> reports(@RequestParam(required = false) String status) {
        return ApiResponse.success(repository.reportsAdmin(status));
    }

    @PostMapping("/reports/{id}/audit")
    public ApiResponse<Map<String, Object>> auditReport(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.auditReport(id, body, operator(user)));
    }

    @GetMapping("/attestations")
    public ApiResponse<Map<String, Object>> attestations() {
        return ApiResponse.success(repository.attestationsAdmin());
    }

    @PostMapping("/attestations")
    public ApiResponse<Map<String, Object>> createAttestation(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.createAttestation(body, operator(user)));
    }

    @GetMapping("/experts")
    public ApiResponse<Map<String, Object>> experts(@RequestParam(required = false) String status) {
        return ApiResponse.success(repository.expertsAdmin(status));
    }

    @PostMapping("/experts/{id}/audit")
    public ApiResponse<Map<String, Object>> auditExpert(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.auditExpert(id, body, operator(user)));
    }

    // ---------- 培训课程与视频 ----------

    @GetMapping("/courses")
    public ApiResponse<Map<String, Object>> courses() {
        return ApiResponse.success(repository.courses());
    }

    @GetMapping("/courses/{id}/lessons")
    public ApiResponse<List<Map<String, Object>>> lessons(@PathVariable long id) {
        return ApiResponse.success(repository.lessons(id));
    }

    @PostMapping("/courses")
    public ApiResponse<Map<String, Object>> saveCourse(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.saveCourse(body, operator(user)));
    }

    @PostMapping("/courses/{id}/publish")
    public ApiResponse<Map<String, Object>> publishCourse(
            @PathVariable long id,
            @RequestParam(required = false, defaultValue = "published") String status,
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.publishCourse(id, status, operator(user)));
    }

    @DeleteMapping("/courses/{id}")
    public ApiResponse<Map<String, Object>> deleteCourse(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.deleteCourse(id, operator(user)));
    }

    @PostMapping("/courses/{id}/lessons")
    public ApiResponse<Map<String, Object>> saveLesson(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.saveLesson(id, body, operator(user)));
    }

    @DeleteMapping("/courses/{id}/lessons/{lessonId}")
    public ApiResponse<Map<String, Object>> deleteLesson(
            @PathVariable long id,
            @PathVariable long lessonId,
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.deleteLesson(id, lessonId, operator(user)));
    }

    /**
     * 课程视频上传。返回相对路径（如 course-2/lesson-xxx.mp4），运营端把它写进章节的 videoUrl。
     *
     * <p>走运营端域：上传是写操作，必须受 info:admin 保护；
     * 网关对 {@code /api/v1/info/ops/media/} 单独放开了大体积请求，其他接口仍是默认限制。</p>
     */
    @PostMapping("/media/upload")
    public ApiResponse<Map<String, Object>> upload(
            @RequestParam("courseId") long courseId,
            @RequestPart("file") MultipartFile file) throws IOException {
        return ApiResponse.success(mediaStorage.store(courseId, file));
    }

    // ---------- 统计与审计 ----------

    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats() {
        Map<String, Object> result = repository.stats();
        // 供需统计同样走交易模块实时数，字段名与报表页既有约定保持一致
        result.put("sdStats", supplyDemandService.counts());
        return ApiResponse.success(result);
    }

    @GetMapping("/audit-logs")
    public ApiResponse<List<Map<String, Object>>> auditLogs() {
        return ApiResponse.success(repository.auditLogs());
    }
}
