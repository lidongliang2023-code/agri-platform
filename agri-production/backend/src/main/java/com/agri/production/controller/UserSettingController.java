package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.IUserSettingService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.UserSettingItemVO;
import com.agri.production.vo.UserSettingVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 用户端：系统设置·参数配置（{@code /api/v1/production/settings}）。
 *
 * <p>三条路径就是页面真会调的：{@code GET /settings}（列表）、
 * {@code GET /settings/by-key?settingKey=}、{@code POST /settings/save}（按 key upsert）。</p>
 *
 * <p><b>列表刻意返回裸数组</b>：页面 {@code listSettings()} 声明的是 {@code SettingItem[]}，
 * 而 {@code request.ts} 的归一化只在 {@code data.records} 是数组时才转成分页结构 ——
 * 返 {@code {records,total}} 会让页面拿到一个对象、表格直接空掉。</p>
 *
 * <p>不实现 {@code GET/PUT /settings/tenant} 与 {@code GET /settings/logs}：
 * 前者的租户档案属平台域主数据（网关已把这一族整条交回平台侧），后者本部署没有操作日志表、
 * 页面已按「未接入」显式提示。刻意不写 {@code @GetMapping("/{id}")} ——
 * 那种吃任意段的映射会把 {@code /by-key} 之类字面量路径一并吞掉（这项目里栽过）。</p>
 */
@RestController
@RequestMapping("/api/v1/production/settings")
public class UserSettingController {

    private final IUserSettingService settingService;

    public UserSettingController(IUserSettingService settingService) {
        this.settingService = settingService;
    }

    /** 配置项列表（裸数组，字段名按页面 SettingItem）。 */
    @GetMapping
    public ApiResponse<List<UserSettingItemVO>> list() {
        return ApiResponse.success(settingService.list(TenantContextService.currentTenantId()));
    }

    /** 按配置键查一条（不存在时 data 为 null，不是报错）。 */
    @GetMapping("/by-key")
    public ApiResponse<UserSettingVO> byKey(@RequestParam String settingKey) {
        return ApiResponse.success(settingService.byKey(TenantContextService.currentTenantId(), settingKey));
    }

    /** 保存配置（body {settingKey, settingValue, remark}；按 key upsert）。 */
    @PostMapping("/save")
    public ApiResponse<UserSettingVO> save(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(settingService.save(
                TenantContextService.currentTenantId(),
                body == null ? null : str(body.get("settingKey")),
                body == null ? null : str(body.get("settingValue")),
                body == null ? null : str(body.get("remark"))));
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        return String.valueOf(value);
    }
}
