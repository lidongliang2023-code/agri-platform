package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.TenantContextService;
import com.agri.production.service.impl.FarmDetailServiceImpl;
import com.agri.production.vo.FarmCertVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 农场详情：资质证照 / 汇总 / 启停（{@code /api/v1/production/farms/{farmId}/**}）。

 *
 * <p>农场标识经 {@link FarmIdResolver} 换算（本地主键 / 农场编码 / 平台标识 DEMO-FARM-xxx），
 * 换不出来报 400 并说明收到了什么 —— 与农场筛选同口径。</p>
 */
@RestController
@RequestMapping("/api/v1/production/farms/{farmId}")
public class FarmDetailController {

    private final FarmDetailServiceImpl service;
    private final FarmIdResolver farmIdResolver;

    public FarmDetailController(FarmDetailServiceImpl service, FarmIdResolver farmIdResolver) {
        this.service = service;
        this.farmIdResolver = farmIdResolver;
    }

    /** 资质证照分页。 */
    @GetMapping("/certs")
    public ApiResponse<PageResult<FarmCertVO>> certs(
            @PathVariable String farmId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(service.pageCerts(tenantId, farmIdResolver.resolveFilter(farmId, tenantId),
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), keyword, status));
    }

    /** 新增资质证照（返回新证照编号）。 */
    @PostMapping("/certs")
    public ApiResponse<String> createCert(@PathVariable String farmId,
                                         @RequestBody(required = false) Map<String, Object> body) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(service.createCert(tenantId,
                farmIdResolver.resolveFilter(farmId, tenantId), body));
    }

    /** 农场汇总（地块数 / 在种面积 / 任务 / 采收 / 未处理告警 / 设备 / 证照）。 */
    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary(@PathVariable String farmId) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(service.summary(tenantId, farmIdResolver.resolveFilter(farmId, tenantId)));
    }

    /** 启停农场。 */
    @PatchMapping("/status")
    public ApiResponse<Map<String, Object>> changeStatus(@PathVariable String farmId,
                                                        @RequestParam(required = false) Integer status) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(service.changeStatus(tenantId,
                farmIdResolver.resolveFilter(farmId, tenantId), status));
    }

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }
}
