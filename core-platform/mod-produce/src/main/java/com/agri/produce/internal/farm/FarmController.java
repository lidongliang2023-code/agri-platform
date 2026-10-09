package com.agri.produce.internal.farm;

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
import org.springframework.web.bind.annotation.PatchMapping;

/**
 * 农场档案与认证（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/farms")
@RequiredArgsConstructor
public class FarmController {

    private final FarmInfoService farmInfoService;
    private final FarmCertService farmCertService;

    @GetMapping
    public ApiResponse<PageResult<FarmInfoEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                        @RequestParam(defaultValue = "10") long size,
                                                        @RequestParam(required = false) String keyword,
                                                        @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(farmInfoService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<FarmInfoEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(farmInfoService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody FarmInfoEntity entity) {
        return ApiResponse.ok(farmInfoService.create(entity).getFarmId());
    }

    @PutMapping("/{id}")
    public ApiResponse<FarmInfoEntity> update(@PathVariable String id, @RequestBody FarmInfoEntity entity) {
        return ApiResponse.ok(farmInfoService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        farmInfoService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/{farmId}/certs")
    public ApiResponse<PageResult<FarmCertEntity>> pageFarmCert(@RequestParam(defaultValue = "1") long page,
                                                                @RequestParam(defaultValue = "10") long size,
                                                                @RequestParam(required = false) String keyword,
                                                                @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(farmCertService.page(page, size, keyword, status));
    }

    @GetMapping("/{farmId}/certs/{id}")
    public ApiResponse<FarmCertEntity> detailFarmCert(@PathVariable String id) {
        return ApiResponse.ok(farmCertService.detail(id));
    }

    @PostMapping("/{farmId}/certs")
    public ApiResponse<String> createFarmCert(@RequestBody FarmCertEntity entity) {
        return ApiResponse.ok(farmCertService.create(entity).getCertId());
    }

    @PutMapping("/{farmId}/certs/{id}")
    public ApiResponse<FarmCertEntity> updateFarmCert(@PathVariable String id, @RequestBody FarmCertEntity entity) {
        return ApiResponse.ok(farmCertService.update(id, entity));
    }

    @DeleteMapping("/{farmId}/certs/{id}")
    public ApiResponse<Void> deleteFarmCert(@PathVariable String id) {
        farmCertService.delete(id);
        return ApiResponse.ok();
    }

    /** 农场汇总统计 */
    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary() {
        return ApiResponse.ok(farmInfoService.summary());
    }

    /** 认证审核：置为有效 */
    @PostMapping("/{farmId}/certs/{certId}/verify")
    public ApiResponse<FarmCertEntity> verifyCert(@PathVariable String farmId, @PathVariable String certId) {
        return ApiResponse.ok(farmCertService.verify(certId));
    }

    /** 临期认证提醒 */
    @GetMapping("/certs/expiring")
    public ApiResponse<List<FarmCertEntity>> expiring(@RequestParam(defaultValue = "30") int withinDays) {
        return ApiResponse.ok(farmCertService.listExpiring(withinDays));
    }

    /** 全量农场（下拉选择用） */
    @GetMapping("/all")
    public ApiResponse<List<FarmInfoEntity>> all() {
        return ApiResponse.ok(farmInfoService.listAll());
    }

    /** 启停农场 */
    @PatchMapping("/{farmId}/status")
    public ApiResponse<FarmInfoEntity> changeStatus(@PathVariable String farmId,
                                                    @RequestParam Integer status) {
        return ApiResponse.ok(farmInfoService.changeStatus(farmId, status));
    }

    /** 单农场汇总 */
    @GetMapping("/{farmId}/summary")
    public ApiResponse<Map<String, Object>> farmSummary(@PathVariable String farmId) {
        return ApiResponse.ok(farmInfoService.farmSummary(farmId));
    }
}
