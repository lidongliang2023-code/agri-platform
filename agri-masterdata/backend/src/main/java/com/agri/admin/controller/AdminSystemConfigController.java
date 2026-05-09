package com.agri.admin.controller;

import com.agri.admin.service.IAdminSystemConfigService;
import com.agri.admin.vo.SystemConfigVO;
import com.agri.common.entity.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "系统配置管理")
@RestController
@RequestMapping("/admin/masterdata/config")
@RequiredArgsConstructor
public class AdminSystemConfigController {

    private final IAdminSystemConfigService adminSystemConfigService;

    @Operation(summary = "获取系统配置列表")
    @GetMapping("/list")
    public ApiResponse<List<SystemConfigVO>> getSystemConfigList(@RequestParam(required = false) String configType) {
        return ApiResponse.success(adminSystemConfigService.getSystemConfigList(configType));
    }

    @Operation(summary = "获取系统配置详情")
    @GetMapping("/{id}")
    public ApiResponse<SystemConfigVO> getSystemConfigDetail(@PathVariable Long id) {
        return ApiResponse.success(adminSystemConfigService.getSystemConfigDetail(id));
    }

    @Operation(summary = "创建系统配置")
    @PostMapping
    public ApiResponse<Void> createSystemConfig(@RequestBody SystemConfigVO config) {
        adminSystemConfigService.createSystemConfig(config);
        return ApiResponse.success();
    }

    @Operation(summary = "编辑系统配置")
    @PutMapping("/{id}")
    public ApiResponse<Void> updateSystemConfig(@PathVariable Long id, @RequestBody SystemConfigVO config) {
        adminSystemConfigService.updateSystemConfig(id, config);
        return ApiResponse.success();
    }

    @Operation(summary = "删除系统配置")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteSystemConfig(@PathVariable Long id) {
        adminSystemConfigService.deleteSystemConfig(id);
        return ApiResponse.success();
    }

    @Operation(summary = "获取配置值")
    @GetMapping("/value/{configKey}")
    public ApiResponse<String> getConfigValue(@PathVariable String configKey) {
        return ApiResponse.success(adminSystemConfigService.getConfigValue(configKey));
    }

    @Operation(summary = "批量更新配置")
    @PutMapping("/batch")
    public ApiResponse<Void> batchUpdateConfig(@RequestBody Map<String, String> configMap) {
        adminSystemConfigService.batchUpdateConfig(configMap);
        return ApiResponse.success();
    }
}