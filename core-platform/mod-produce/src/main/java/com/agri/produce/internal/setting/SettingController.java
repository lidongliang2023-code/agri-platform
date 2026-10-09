package com.agri.produce.internal.setting;

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
 * 生产域系统设置（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/settings")
@RequiredArgsConstructor
public class SettingController {

    private final SysSettingService sysSettingService;

    @GetMapping
    public ApiResponse<PageResult<SysSettingEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                          @RequestParam(defaultValue = "10") long size,
                                                          @RequestParam(required = false) String keyword,
                                                          @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(sysSettingService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<SysSettingEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(sysSettingService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody SysSettingEntity entity) {
        return ApiResponse.ok(sysSettingService.create(entity).getSettingId());
    }

    @PutMapping("/{id}")
    public ApiResponse<SysSettingEntity> update(@PathVariable String id, @RequestBody SysSettingEntity entity) {
        return ApiResponse.ok(sysSettingService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        sysSettingService.delete(id);
        return ApiResponse.ok();
    }

    /** 按配置键读取 */
    @GetMapping("/by-key")
    public ApiResponse<SysSettingEntity> byKey(@RequestParam String settingKey) {
        return ApiResponse.ok(sysSettingService.getByKey(settingKey));
    }

    /** 保存配置 */
    @PostMapping("/save")
    public ApiResponse<SysSettingEntity> save(@RequestBody SysSettingEntity setting) {
        return ApiResponse.ok(sysSettingService.saveSetting(setting));
    }
}
