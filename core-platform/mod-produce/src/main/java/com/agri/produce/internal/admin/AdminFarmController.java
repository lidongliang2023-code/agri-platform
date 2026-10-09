package com.agri.produce.internal.admin;

import com.agri.produce.internal.farm.FarmInfoEntity;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
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
}
