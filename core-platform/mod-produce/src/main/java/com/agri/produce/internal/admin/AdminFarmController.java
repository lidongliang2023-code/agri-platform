package com.agri.produce.internal.admin;

import com.agri.produce.internal.farm.FarmInfoEntity;
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
 * 运营端：农场监管（/api/v1/production/admin/farms）。
 */
@RestController
@RequestMapping("/api/v1/production/admin/farms")
@RequiredArgsConstructor
public class AdminFarmController {

    private final AdminFarmService adminFarmService;
    private final AdminFarmComplianceService adminFarmComplianceService;

    /** 分页监管农场 */
    @GetMapping
    public ApiResponse<PageResult<FarmInfoEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                        @RequestParam(defaultValue = "10") long size,
                                                        @RequestParam(required = false) String keyword,
                                                        @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(adminFarmService.page(page, size, keyword, status));
    }

    /** 农场合规画像 */
    @GetMapping("/{farmId}/compliance")
    public ApiResponse<Map<String, Object>> compliance(@PathVariable String farmId) {
        return ApiResponse.ok(adminFarmService.compliance(farmId));
    }

    /** 临期认证农场 */
    @GetMapping("/cert-expiring")
    public ApiResponse<List<FarmInfoEntity>> certExpiring(@RequestParam(defaultValue = "30") int withinDays) {
        return ApiResponse.ok(adminFarmService.listCertExpiring(withinDays));
    }

    /** 监管停用/恢复 */
    @PutMapping("/{farmId}/status")
    public ApiResponse<FarmInfoEntity> toggleStatus(@PathVariable String farmId,
                                                    @RequestParam(defaultValue = "true") boolean enable) {
        return ApiResponse.ok(adminFarmService.toggleStatus(farmId, enable));
    }

    /** 农场地理分布（监管地图） */
    @GetMapping("/map")
    public ApiResponse<List<Map<String, Object>>> map() {
        return ApiResponse.ok(adminFarmService.map());
    }

    /** 农场合规清单 */
    @GetMapping("/compliance")
    public ApiResponse<List<Map<String, Object>>> complianceList(@RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.ok(adminFarmService.complianceList(limit));
    }

    /**
     * 合规检查任务台账（PRD 6.2 #11）。
     *
     * <p>与上面的 {@code GET /compliance}（农场合规画像清单，返回 List）区分开：
     * 本端点返回分页体 {@code PageResult}，对应前端
     * {@code listComplianceChecks(params: PageQuery & { farmId?, result? })}。</p>
     */
    @GetMapping("/compliance/checks")
    public ApiResponse<PageResult<FarmComplianceCheckEntity>> complianceChecks(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String farmId,
            @RequestParam(required = false) Integer result) {
        return ApiResponse.ok(adminFarmComplianceService.page(page, size, farmId, result));
    }

    /**
     * 登记合规检查任务（发起抽查）。
     *
     * <p>对应前端 {@code createSupervisedComplianceTask} 调用的
     * {@code POST /admin/farms/compliance}，落库 {@code prod_farm_compliance_check}。</p>
     */
    @PostMapping("/compliance")
    public ApiResponse<FarmComplianceCheckEntity> createCompliance(
            @RequestBody FarmComplianceCheckEntity entity) {
        return ApiResponse.ok(adminFarmComplianceService.create(entity));
    }

    /**
     * 更新合规检查任务（录入检查结果 / 整改跟踪）。
     *
     * <p>对应前端 {@code updateSupervisedComplianceTask} 调用的
     * {@code PUT /admin/farms/compliance/{checkId}}；请求体是局部补丁，
     * 未出现的字段保持库内原值，不会被空值覆盖。</p>
     */
    @PutMapping("/compliance/{checkId}")
    public ApiResponse<FarmComplianceCheckEntity> updateCompliance(
            @PathVariable String checkId,
            @RequestBody FarmComplianceCheckEntity patch) {
        return ApiResponse.ok(adminFarmComplianceService.update(checkId, patch));
    }
}
