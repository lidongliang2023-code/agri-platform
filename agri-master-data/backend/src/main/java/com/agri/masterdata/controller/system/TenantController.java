package com.agri.masterdata.controller.system;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.TenantQuotaDTO;
import com.agri.masterdata.dto.TenantSaveDTO;
import com.agri.masterdata.dto.TenantUpdateDTO;
import com.agri.masterdata.entity.TenantQuota;
import com.agri.masterdata.service.ITenantQuotaService;
import com.agri.masterdata.service.ITenantService;
import com.agri.masterdata.vo.TenantQuotaVO;
import com.agri.masterdata.vo.TenantVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/system/tenant")
@RequiredArgsConstructor
@Tag(name = "租户管理", description = "租户管理接口")
public class TenantController {

    private final ITenantService tenantService;
    private final ITenantQuotaService tenantQuotaService;

    @GetMapping("/page")
    @Operation(summary = "分页查询租户列表")
    public ApiResponse<PageResult<TenantVO>> page(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer pageNum,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "10") Integer pageSize,
            @Parameter(description = "租户名称") @RequestParam(required = false) String tenantName,
            @Parameter(description = "租户类型") @RequestParam(required = false) String tenantType) {
        return ApiResponse.success(tenantService.page(pageNum, pageSize, tenantName, tenantType));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取租户详情")
    public ApiResponse<TenantVO> getById(@Parameter(description = "租户ID") @PathVariable Long id) {
        return ApiResponse.success(tenantService.getById(id));
    }

    @GetMapping("/code/{tenantCode}")
    @Operation(summary = "根据租户编码获取租户")
    public ApiResponse<TenantVO> getByTenantCode(@Parameter(description = "租户编码") @PathVariable String tenantCode) {
        return ApiResponse.success(tenantService.getByTenantCode(tenantCode));
    }

    @PostMapping
    @Operation(summary = "新增租户")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> save(@Valid @RequestBody TenantSaveDTO dto) {
        tenantService.save(dto);
        return ApiResponse.created();
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新租户")
    public ApiResponse<Void> update(@Parameter(description = "租户ID") @PathVariable Long id,
                                    @Valid @RequestBody TenantUpdateDTO dto) {
        tenantService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除租户")
    public ApiResponse<Void> delete(@Parameter(description = "租户ID") @PathVariable Long id) {
        tenantService.delete(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "修改租户状态")
    public ApiResponse<Void> changeStatus(@Parameter(description = "租户ID") @PathVariable Long id,
                                          @Parameter(description = "状态：1-正常，2-禁用") @RequestParam Integer status) {
        tenantService.changeStatus(id, status);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/quota")
    @Operation(summary = "获取租户配额")
    public ApiResponse<List<TenantQuota>> getQuota(@Parameter(description = "租户ID") @PathVariable String id) {
        return ApiResponse.success(tenantQuotaService.getByTenantId(id));
    }

    @PutMapping("/{id}/quota")
    @Operation(summary = "配置租户配额")
    public ApiResponse<Void> updateQuota(@Parameter(description = "租户ID") @PathVariable String id,
                                         @RequestBody List<TenantQuotaDTO> quotas) {
        for (TenantQuotaDTO quota : quotas) {
            tenantQuotaService.updateQuota(id, quota.getQuotaType(), quota.getMaxValue());
        }
        return ApiResponse.success();
    }

    @GetMapping("/{id}/statistics")
    @Operation(summary = "获取租户统计数据")
    public ApiResponse<Map<String, Object>> getStatistics(@Parameter(description = "租户ID") @PathVariable String id) {
        Map<String, Object> stats = new HashMap<>();
        List<TenantQuota> quotas = tenantQuotaService.getByTenantId(id);
        for (TenantQuota quota : quotas) {
            stats.put(quota.getQuotaType(), Map.of(
                    "max", quota.getMaxValue(),
                    "current", quota.getCurrentValue(),
                    "usage", quota.getMaxValue() > 0 ? (double) quota.getCurrentValue() / quota.getMaxValue() * 100 : 0
            ));
        }
        return ApiResponse.success(stats);
    }
}