package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.constant.CropCategoryDict;
import com.agri.common.rbac.OperatorOnly;
import com.agri.production.entity.CropInfo;
import com.agri.production.service.CropMasterService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.CropVO;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 作物主数据（{@code /api/v1/production/crops}）。

 *
 * <p><b>读写两侧的口径不一样（2026-10-16 产品口径）</b>：
 * 作物主数据放在生产管理模块，但**由运营端维护** —— 农户只在计划 / 地块里选作物。
 * 所以写接口（增删改 / 启停）挂 {@link OperatorOnly}（默认要求平台权限码
 * {@code production:write}，市场运营与超管有、{@code FARMER} 没有），
 * 而 {@link #options()} / {@link #categories()} / 分页这类**读**接口对用户端开放（下拉要用）。</p>

 *
 * <p>页面侧也对应：维护页在运营端 {@code /admin/production/crops}，用户端只有下拉。</p>

 *
 * <p>主键路径都限定 {@code \d+}，免得 {@code /options}、{@code /categories} 被 {@code /{id}} 吃掉
 * （与 /plots/stats 同法）。</p>
 */
@RestController
@RequestMapping("/api/v1/production/crops")
public class CropController {

    private final CropMasterService service;

    public CropController(CropMasterService service) {
        this.service = service;
    }

    /** 分页查询（页面「作物管理」列表）。 */
    @GetMapping
    public ApiResponse<PageResult<CropVO>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(service.page(
                firstNonNull(1, pageNum, page),
                firstNonNull(10, pageSize, size),
                keyword, status, tenantId));
    }

    /**
     * 作物类别的受控取值。

     *
     * <p>出给页面做下拉选项：前端不再自己抄一份类别清单 —— 抄两份就是下一次"两边不一致"
     * （本服务与页面不在同一个发布节奏里）。</p>
     */
    @GetMapping("/categories")
    public ApiResponse<List<String>> categories() {
        return ApiResponse.success(CropCategoryDict.values());
    }

    /**
     * 下拉选项：只给启用中的作物。
     *
     * <p>出参是**裸数组**（页面 {@code listCropOptions(): Promise<CropOption[]>}，与 /farms/all 同法），
     * 不套 PageResult。</p>
     */
    @GetMapping("/options")
    public ApiResponse<List<Map<String, Object>>> options() {
        return ApiResponse.success(service.options(TenantContextService.currentTenantId()));
    }

    /**
     * 新增作物。
     *
     * <p>返回**新作物主键字符串**：本服务所有 POST 的契约都是"直取 data 即 id"
     * （页面拿它跳详情 / 存关联，返回对象会拼出 {@code [object Object]}）。</p>
     */
    @OperatorOnly
    @PostMapping
    public ApiResponse<String> create(@RequestBody(required = false) Map<String, Object> payload) {
        String tenantId = TenantContextService.currentTenantId();
        CropInfo saved = service.create(payload == null ? Map.of() : payload, tenantId);
        return ApiResponse.success(String.valueOf(saved.getId()));
    }

    /** 修改作物（未下发的字段保持原值）。 */
    @OperatorOnly
    @PutMapping("/{id:\\d+}")
    public ApiResponse<CropVO> update(@PathVariable Long id,
                                      @RequestBody(required = false) Map<String, Object> payload) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(CropVO.of(service.update(id, payload == null ? Map.of() : payload, tenantId)));
    }

    /** 启用 / 停用。 */
    @OperatorOnly
    @PatchMapping("/{id:\\d+}/status")
    public ApiResponse<CropVO> changeStatus(@PathVariable Long id,
                                            @RequestParam(required = false) Integer status) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(CropVO.of(service.changeStatus(id, status, tenantId)));
    }

    /** 删除（逻辑删除；已被计划引用则拒绝，改用停用）。 */
    @OperatorOnly
    @DeleteMapping("/{id:\\d+}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id, TenantContextService.currentTenantId());
        return ApiResponse.success();
    }

    private static int firstNonNull(int fallback, Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return fallback;
    }
}
