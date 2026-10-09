package com.agri.produce.internal.admin;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 运营端：租户与配额管理。
 */
@RestController
@RequestMapping("/api/v1/production/admin/tenants")
@RequiredArgsConstructor
public class AdminTenantController {

    private final TenantQuotaService tenantQuotaService;
    private final TenantOverviewService tenantOverviewService;

    /** 平台级租户概览（汇总卡片 + 逐租户明细） */
    @GetMapping("/overview")
    public ApiResponse<TenantOverview> overview() {
        return ApiResponse.ok(tenantOverviewService.overview());
    }

    /** 单租户概览 */
    @GetMapping("/overview/{tenantId}")
    public ApiResponse<TenantOverviewRow> tenantOverview(@PathVariable Long tenantId) {
        return ApiResponse.ok(tenantOverviewService.tenantOverview(tenantId));
    }

    @GetMapping
    public ApiResponse<PageResult<TenantQuotaEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                           @RequestParam(defaultValue = "10") long size,
                                                           @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(tenantQuotaService.page(page, size, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<TenantQuotaEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(tenantQuotaService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody TenantQuotaEntity entity) {
        return ApiResponse.ok(tenantQuotaService.create(entity).getQuotaId());
    }

    @PutMapping("/{id}")
    public ApiResponse<TenantQuotaEntity> update(@PathVariable String id, @RequestBody TenantQuotaEntity entity) {
        return ApiResponse.ok(tenantQuotaService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        tenantQuotaService.delete(id);
        return ApiResponse.ok();
    }

    /** 配额使用率 */
    @GetMapping("/{quotaId}/usage")
    public ApiResponse<Map<String, Object>> usage(@PathVariable String quotaId) {
        return ApiResponse.ok(tenantQuotaService.usage(quotaId));
    }

    /** 重算已用配额 */
    @PostMapping("/{quotaId}/reset-usage")
    public ApiResponse<TenantQuotaEntity> resetUsage(@PathVariable String quotaId) {
        return ApiResponse.ok(tenantQuotaService.resetUsage(quotaId));
    }

    /** 配额列表 */
    @GetMapping("/quotas")
    public ApiResponse<PageResult<TenantQuotaEntity>> quotas(@RequestParam(defaultValue = "1") long page,
                                                             @RequestParam(defaultValue = "10") long size,
                                                             @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(tenantQuotaService.page(page, size, status));
    }

    /** 租户分段（按农场配额使用率分层） */
    @GetMapping("/segments")
    public ApiResponse<List<Map<String, Object>>> segments() {
        return ApiResponse.ok(tenantQuotaService.segments());
    }

    /**
     * 租户配额概览（四项：农场 / 溯源码 / 存储 / API）。
     *
     * <p>{@code tenantId} 可传配额记录主键 {@code quotaId} 或 {@code tenantCode}——
     * 库内暂无租户主表，租户以配额记录为载体。</p>
     *
     * <p>每项带 {@code source} 标记用量数据来源：只有农场数有真实用量列，
     * 其余三项当前<strong>无用量数据源</strong>（{@code source=NONE}，used 为 0 仅用于满足结构），
     * 前端应展示「—」而非 0。</p>
     *
     * @param tenantId 租户标识
     * @return 四项配额
     */
    @GetMapping("/{tenantId}/quota-overview")
    public ApiResponse<List<OpsQuotaItem>> tenantQuotaOverview(@PathVariable String tenantId) {
        return ApiResponse.ok(tenantQuotaService.quotaOverview(tenantId));
    }

    /**
     * 全平台租户配额一览（分页）。
     *
     * @param page        页码，默认 1
     * @param size        每页条数，默认 10
     * @param tenantName  租户名称模糊匹配，可为空
     * @param onlyWarning 仅看预警（最高使用率 ≥ 80%）
     * @return 一览分页结果
     */
    @GetMapping("/quota-overview")
    public ApiResponse<PageResult<OpsTenantQuotaRow>> quotaOverview(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String tenantName,
            @RequestParam(required = false) Boolean onlyWarning) {
        return ApiResponse.ok(tenantQuotaService.quotaOverviewPage(page, size, tenantName, onlyWarning));
    }

    /**
     * 调整租户配额上限（四项整体提交，只更新传入的项）。
     *
     * @param tenantId 租户标识
     * @param body     待调整的上限项
     * @return 更新后的配额实体
     */
    @PutMapping("/{tenantId}/quota-limits")
    public ApiResponse<TenantQuotaEntity> updateQuotaLimits(@PathVariable String tenantId,
                                                            @RequestBody QuotaLimitRequest body) {
        return ApiResponse.ok(tenantQuotaService.updateQuotaLimits(tenantId, body.farmLimit(),
                body.traceCodeLimit(), body.storageLimit(), body.apiLimit()));
    }

    /**
     * 批量调整配额上限：整批一个事务，单条失败不影响其余。
     *
     * @param body 租户列表与待调整上限
     * @return 逐条结果
     */
    @PutMapping("/quota-limits/batch")
    public ApiResponse<List<QuotaLimitBatchResult>> batchUpdateQuotaLimits(
            @RequestBody BatchQuotaLimitRequest body) {
        return ApiResponse.ok(tenantQuotaService.batchUpdateQuotaLimits(body.tenantIds(), body.farmLimit(),
                body.traceCodeLimit(), body.storageLimit(), body.apiLimit()));
    }

    /** 调整配额上限入参 */
    public record QuotaLimitRequest(Integer farmLimit, Integer traceCodeLimit,
                                    BigDecimal storageLimit, Integer apiLimit) {
    }

    /** 批量调整配额上限入参 */
    public record BatchQuotaLimitRequest(List<String> tenantIds, Integer farmLimit,
                                         Integer traceCodeLimit, BigDecimal storageLimit,
                                         Integer apiLimit) {
    }
}
