package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.ITraceLifecycleService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.TraceCodeContractVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 溯源码（用户端）。路径按前端契约 {@code api/trace.ts}（BASE = {@code /api/v1/production/trace}）。
 *
 * <p>这个控制器替换掉旧的那一版：旧路径是 {@code /trace/generate}、{@code /trace/{code}/activate}、
 * {@code /trace/query/{code}}、{@code /trace/code/{code}} —— 前端一条都不调，
 * 而页面真正用的 {@code /codes}、{@code /codes/{code}}、{@code /codes/generate}、
 * {@code /codes/expire}、{@code /activate}、{@code /scan}、{@code /{code}/revoke}、
 * {@code /batches/{id}(+/generate)} 一个都没有。同一个路径下两个控制器会让
 * {@code GET /trace} 映射冲突、应用起不来，所以是替换。</p>
 *
 * <p><b>字面量路径先于 {@code /{code}} 匹配</b>：{@code /codes/**}、{@code /activate}、
 * {@code /scan}、{@code /batches/**} 都是字面量，Spring 优先命中；否则
 * {@code GET /trace/codes} 会被 {@code GET /trace/{code}} 接走，把 "codes" 当成码值去查。
 * 本仓库已在 /inputs/stock、/plots/stats 上踩过同类坑。</p>
 */
@RestController
@RequestMapping("/api/v1/production/trace")
public class TraceController {

    private final ITraceLifecycleService traceService;

    public TraceController(ITraceLifecycleService traceService) {
        this.traceService = traceService;
    }

    /** 分页查询溯源码（前端 fetchTraceCodePage，入参 page/size/status）。 */
    @GetMapping("/codes")
    public ApiResponse<PageResult<TraceCodeContractVO>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(traceService.page(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                status, TenantContextService.currentTenantId()));
    }

    /** 为批次生成溯源码（前端 generateTraceCode，入参在查询串里）。 */
    @PostMapping("/codes/generate")
    public ApiResponse<String> generate(
            @RequestParam(required = false) String batchId,
            @RequestParam(required = false) String expireDate) {
        return ApiResponse.success(traceService.generate(batchId, expireDate,
                TenantContextService.currentTenantId()));
    }

    /** 批量激活（前端 activateTraceCodes，PATCH + body {codes}）。 */
    @PatchMapping("/codes/activate")
    public ApiResponse<Integer> batchActivate(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(traceService.batchUpdateStatus(codes(body), "active",
                TenantContextService.currentTenantId()));
    }

    /** 批量作废（前端 expireTraceCodes，PATCH + body {codes}）。 */
    @PatchMapping("/codes/expire")
    public ApiResponse<Integer> batchExpire(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(traceService.batchUpdateStatus(codes(body), "expired",
                TenantContextService.currentTenantId()));
    }

    /** 单码详情（前端 fetchTraceCodeDetail 走 /trace/{code}；另有调用方走 /trace/codes/{code}）。 */
    @GetMapping("/codes/{code}")
    public ApiResponse<TraceCodeContractVO> detailByCodesPath(@PathVariable String code) {
        return ApiResponse.success(traceService.detail(code, TenantContextService.currentTenantId()));
    }

    /**
     * 激活单个码（前端 activateTraceCode，参数在查询串里）。
     *
     * <p>契约注释说这一步要发 {@code prod.trace.activated} 事件：本服务没有事件总线，
     * 因此没有伪造该事件（与批次、质检两处一并记在缺口里）。</p>
     */
    @PostMapping("/activate")
    public ApiResponse<TraceCodeContractVO> activate(@RequestParam(required = false) String code,
                                            @RequestParam(required = false) String activatedBy) {
        return ApiResponse.success(traceService.activate(code, activatedBy,
                TenantContextService.currentTenantId()));
    }

    /** 扫码累计（前端 scanTraceCode，参数在查询串里）。 */
    @PostMapping("/scan")
    public ApiResponse<TraceCodeContractVO> scan(@RequestParam(required = false) String code) {
        return ApiResponse.success(traceService.scan(code, TenantContextService.currentTenantId()));
    }

    /** 批次下的溯源码（前端 listCodesByBatch）。 */
    @GetMapping("/batches/{batchId}")
    public ApiResponse<List<TraceCodeContractVO>> codesByBatch(@PathVariable String batchId) {
        return ApiResponse.success(traceService.listByBatch(batchId, TenantContextService.currentTenantId()));
    }

    /** 按批次生成（前端 generateTraceCodeByBatch）。 */
    @PostMapping("/batches/{batchId}/generate")
    public ApiResponse<String> generateByBatch(@PathVariable String batchId) {
        return ApiResponse.success(traceService.generate(batchId, null,
                TenantContextService.currentTenantId()));
    }

    /** 单码详情（前端 getTraceCode 走 /trace/{code}）。 */
    @GetMapping("/{code}")
    public ApiResponse<TraceCodeContractVO> detail(@PathVariable String code) {
        return ApiResponse.success(traceService.detail(code, TenantContextService.currentTenantId()));
    }

    /** 作废单个码（前端 revokeTraceCode）。 */
    @PostMapping("/{code}/revoke")
    public ApiResponse<TraceCodeContractVO> revoke(@PathVariable String code) {
        return ApiResponse.success(traceService.revoke(code, TenantContextService.currentTenantId()));
    }

    /* ==================== 内部工具 ==================== */

    /** 从 body 里取 codes 数组；缺失即空列表，由服务层给出可读的 400。 */
    @SuppressWarnings("unchecked")
    private static List<String> codes(Map<String, Object> body) {
        if (body == null) {
            return List.of();
        }
        Object raw = body.get("codes");
        if (raw instanceof List<?> list) {
            return ((List<Object>) list).stream().map(String::valueOf).toList();
        }
        return List.of();
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
