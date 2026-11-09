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
 * <p>主体档案由平台权威绑定只读映射；操作日志由独立控制器承接。</p>
 */
@RestController
@RequestMapping("/api/v1/production/settings")
public class UserSettingController {

    private final IUserSettingService settingService;

    public UserSettingController(IUserSettingService settingService) {
        this.settingService = settingService;
    }

    /** 当前经营主体的权威资料，只读，不与配置主键路由混用。 */
    @GetMapping("/tenant")
    public ApiResponse<Map<String, Object>> tenant() {
        return ApiResponse.success(TenantContextService.currentTenantProfile());
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
