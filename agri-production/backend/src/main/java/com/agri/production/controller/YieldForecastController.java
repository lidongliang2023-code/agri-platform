package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.TenantContextService;
import com.agri.production.service.YieldForecastService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 产量预测与销售建议：只保存预测快照和建议，不修改采收、库存或交易订单。 */
@RestController
@RequestMapping("/api/v1/production/yield-forecasts")
public class YieldForecastController {
    private final YieldForecastService service;
    public YieldForecastController(YieldForecastService service) { this.service = service; }
    private String tenant() { return TenantContextService.currentTenantId(); }
    private String operator() { return TenantContextService.currentOperator(); }

    @GetMapping
    public ApiResponse<Object> list(@RequestParam(defaultValue = "1") int pageNum,
                                    @RequestParam(defaultValue = "20") int pageSize,
                                    @RequestParam(required = false) String status) {
        return ApiResponse.success(service.list(tenant(), pageNum, pageSize, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<Object> detail(@PathVariable String id) { return ApiResponse.success(service.detail(tenant(), id)); }

    @PostMapping("/infer")
    public ApiResponse<Object> infer(@RequestBody Map<String, Object> request) {
        return ApiResponse.success(service.infer(tenant(), request, operator()));
    }

    @PostMapping("/{id}/feedback")
    public ApiResponse<Object> feedback(@PathVariable String id, @RequestBody Map<String, Object> request) {
        return ApiResponse.success(service.feedback(tenant(), id, request, operator()));
    }

    @PostMapping("/{id}/invalidate")
    public ApiResponse<Object> invalidate(@PathVariable String id, @RequestBody Map<String, Object> request) {
        return ApiResponse.success(service.invalidate(tenant(), id, request, operator()));
    }
}
