package com.agri.produce.internal.admin.foodsafety;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：食品安全（{@code /api/v1/production/admin/food-safety}）。
 *
 * <p>对应前端 {@code src/pages/admin/foodSafety/} 的 5 个页面（P15~P19）。
 * 已实现 P15 监控中心 4 个端点；P16~P19 见后续同一契约（§3~§6）。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/food-safety")
@RequiredArgsConstructor
public class AdminFoodSafetyController {

    private final AdminFoodSafetyMonitorService monitorService;
    private final AdminFoodSafetyCirculationService circulationService;
    private final AdminFoodSafetyComplianceService complianceService;
    private final AdminFoodSafetyTrustService trustService;
    private final AdminFoodSafetyColdChainService coldChainService;

    /** P15 监控中心核心指标 */
    @GetMapping("/metrics")
    public ApiResponse<Map<String, Object>> metrics() {
        return ApiResponse.ok(monitorService.metrics());
    }

    /** P15 农场风险评分（4×4 热力图） */
    @GetMapping("/risk-distribution")
    public ApiResponse<List<FarmRiskEntity>> riskDistribution() {
        return ApiResponse.ok(monitorService.riskDistribution());
    }

    /** P15 食品安全告警列表 */
    @GetMapping("/alerts")
    public ApiResponse<List<FoodSafetyAlertEntity>> alerts(@RequestParam(required = false) Integer limit) {
        return ApiResponse.ok(monitorService.listAlerts(limit));
    }

    /** P15 处置食品安全告警（写） */
    @PostMapping("/alerts/{id}/handle")
    public ApiResponse<Boolean> handleAlert(@PathVariable String id,
                                            @RequestBody FoodSafetyAlertHandleRequest request) {
        return ApiResponse.ok(monitorService.handleAlert(id, request));
    }

    /** P16 流通异常检测列表（分页） */
    @GetMapping("/circulation")
    public ApiResponse<PageResult<CirculationAnomalyEntity>> circulation(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(circulationService.page(page, size, type, severity, date, keyword));
    }

    /** P16 处理流通异常（写） */
    @PostMapping("/circulation/{id}/handle")
    public ApiResponse<Boolean> handleCirculation(@PathVariable String id,
                                                  @RequestBody CirculationHandleRequest request) {
        return ApiResponse.ok(circulationService.handle(id, request));
    }

    /* ==================== P17 合规校验管理 ==================== */

    /** P17 Tab1 投入品合规台账（分页） */
    @GetMapping("/compliance/inputs")
    public ApiResponse<PageResult<InputComplianceEntity>> complianceInputs(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String farmName,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(complianceService.pageInputs(page, size, result, farmName, keyword));
    }

    /** P17 Tab1 超标处罚登记（写） */
    @PostMapping("/compliance/inputs/{id}/punish")
    public ApiResponse<Boolean> punishInput(@PathVariable String id,
                                            @RequestBody InputPunishRequest request) {
        return ApiResponse.ok(complianceService.punish(id, request));
    }

    /** P17 Tab2 产品标签合规列表（分页） */
    @GetMapping("/compliance/labels")
    public ApiResponse<PageResult<LabelComplianceEntity>> complianceLabels(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String productName,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(complianceService.pageLabels(page, size, result, productName, keyword));
    }

    /** P17 Tab2 下发标签整改通知（写） */
    @PostMapping("/compliance/labels/{id}/rectify")
    public ApiResponse<Boolean> rectifyLabel(@PathVariable String id,
                                             @RequestBody LabelRectifyRequest request) {
        return ApiResponse.ok(complianceService.rectify(id, request));
    }

    /** P17 Tab3 行业标准库下拉 */
    @GetMapping("/compliance/standards")
    public ApiResponse<List<StandardLibraryEntity>> standards() {
        return ApiResponse.ok(complianceService.listStandards());
    }

    /** P17 Tab3 标准校验项明细 */
    @GetMapping("/compliance/standards/{standardNo}/items")
    public ApiResponse<List<StandardItemEntity>> standardItems(@PathVariable String standardNo) {
        return ApiResponse.ok(complianceService.listStandardItems(standardNo));
    }

    /** P17 Tab3 标准校验汇总 */
    @GetMapping("/compliance/standards/{standardNo}/summary")
    public ApiResponse<StandardSummaryEntity> standardSummary(@PathVariable String standardNo) {
        return ApiResponse.ok(complianceService.standardSummary(standardNo));
    }

    /** P17 Tab3 执行行业标准自动校验（写，真实重算） */
    @PostMapping("/compliance/standards/{standardNo}/run")
    public ApiResponse<StandardSummaryEntity> runStandard(@PathVariable String standardNo,
                                                          @RequestBody StandardRunRequest request) {
        return ApiResponse.ok(complianceService.runStandard(standardNo, request));
    }

    /* ==================== P18 可信农产品管理 ==================== */

    /** P18 可信农产品统计 */
    @GetMapping("/trust-label/stats")
    public ApiResponse<Map<String, Object>> trustStats() {
        return ApiResponse.ok(trustService.stats());
    }

    /** P18 可信农产品名单（分页） */
    @GetMapping("/trust-label/products")
    public ApiResponse<PageResult<TrustProductEntity>> trustProducts(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String auditStatus,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(trustService.pageProducts(page, size, level, auditStatus, name, keyword));
    }

    /** P18 编辑可信农产品（写） */
    @PutMapping("/trust-label/products/{id}")
    public ApiResponse<Boolean> updateTrustProduct(@PathVariable String id,
                                                   @RequestBody TrustProductUpdateRequest request) {
        return ApiResponse.ok(trustService.update(id, request));
    }

    /** P18 可信农产品审核（写） */
    @PostMapping("/trust-label/products/{id}/audit")
    public ApiResponse<Boolean> auditTrustProduct(@PathVariable String id,
                                                  @RequestBody TrustAuditRequest request) {
        return ApiResponse.ok(trustService.audit(id, request));
    }

    /* ==================== P19 冷链资源撮合 ==================== */

    /** P19 冷链资源统计 */
    @GetMapping("/cold-chain/stats")
    public ApiResponse<Map<String, Object>> coldChainStats() {
        return ApiResponse.ok(coldChainService.stats());
    }

    /** P19 冷链资源列表（分页，资源卡） */
    @GetMapping("/cold-chain/resources")
    public ApiResponse<PageResult<ColdChainResourceEntity>> coldChainResources(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "8") long size,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(coldChainService.pageResources(page, size, type, status, city, keyword));
    }

    /** P19 撮合记录列表（分页） */
    @GetMapping("/cold-chain/matches")
    public ApiResponse<PageResult<ColdChainMatchEntity>> coldChainMatches(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(coldChainService.pageMatches(page, size, status, keyword));
    }

    /** P19 立即撮合（写） */
    @PostMapping("/cold-chain/matches")
    public ApiResponse<ColdChainMatchEntity> createMatch(@RequestBody MatchCreateRequest request) {
        return ApiResponse.ok(coldChainService.createMatch(request));
    }

    /** P19 繁忙资源加入撮合队列（写） */
    @PostMapping("/cold-chain/queue")
    public ApiResponse<ColdChainMatchEntity> queueMatch(@RequestBody QueueRequest request) {
        return ApiResponse.ok(coldChainService.queue(request));
    }
}
