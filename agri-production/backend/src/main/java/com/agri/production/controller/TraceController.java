package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.ITraceLifecycleService;
import com.agri.production.service.TraceCodeFilter;
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

    /**
     * 分页查询溯源码（前端 fetchTraceCodePage，入参 page/size/status）。
     *
     * <p>除 status 外还收 {@code keyword / farmId / chain / expiry / from / to}，
     * 全部在服务端生效（见 {@code TraceCodeFilter}）。非法取值返回 400 并列出可选项 ——
     * 静默忽略等于让用户以为筛过了。</p>
     */
    @GetMapping("/codes")
    public ApiResponse<PageResult<TraceCodeContractVO>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String farmId,
            @RequestParam(required = false) String chain,
            @RequestParam(required = false) String expiry,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return ApiResponse.success(traceService.page(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                TraceCodeFilter.of(status, keyword, farmId, chain, expiry, from, to),
                TenantContextService.currentTenantId()));
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

    /**
     * 到期扫描（手动触发，仅本主体）：把过了"有效期至"的码置为 expired，返回条数。
     *
     * <p>定时任务（{@code TraceCodeExpiryJob}，扫全部主体）走的是同一个服务方法；
     * 这条入口存在的意义是"结果可被立刻确认"，而不是让人等下一个整点。</p>
     */
    @PatchMapping("/codes/expire-overdue")
    public ApiResponse<Integer> expireOverdue() {
        return ApiResponse.success(traceService.expireOverdue(TenantContextService.currentTenantId()));
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

    /**
     * 全链路节点（前端 fetchFullChainNodes）。
     *
     * <p>派生聚合：采收批次 + 该批次质检 + 该批次库存流水 + 该地块投入品使用 + 该批次溯源码。
     * 哪个域没数据就没有那一段，不补空节点。</p>
     *
     * <p>节点上的链上凭证（{@code onChain/txHash/chainStatus/recordNo/...}）按存证表真实记录判定，
     * 与 {@code /public/verify} 同一口径 —— 属主页和核验页对同一批次只能有一个结论。</p>
     */
    @GetMapping("/full-chain/{batchId}/nodes")
    public ApiResponse<List<Map<String, Object>>> fullChainNodes(@PathVariable String batchId) {
        return ApiResponse.success(traceService.fullChainNodes(batchId, TenantContextService.currentTenantId()));
    }

    /** 按溯源码取全链路（前端 traceByCode）。 */
    @GetMapping("/full-chain/trace/{code}")
    public ApiResponse<List<Map<String, Object>>> fullChainByCode(@PathVariable String code) {
        return ApiResponse.success(traceService.fullChainByCode(code, TenantContextService.currentTenantId()));
    }

    /**
     * 溯源核验（跨主体，公众与监管免登录可用）：{@code GET /api/v1/production/trace/public/verify/{code}}。
     *
     * <p>这条刻意**不按调用方主体过滤**，也不要求令牌：溯源码的意义就是"任何人拿到都能验"，
     * 监管端的公众查询页与移动端扫码都没有生产主体的身份。作为交换，出参只给核验要用的字段
     * （产品/批次/生产主体名/码状态/节点时间线/链上凭证），节点是否"已上链"按
     * {@code agri_prod_chain_record} 的真实记录判定，与属主侧 {@code /full-chain/**}
     * 共用同一处判定（有多少条、几条 SUCCESS、几条没成功，都照实说）。</p>
     */
    @GetMapping("/public/verify/{code}")
    public ApiResponse<Map<String, Object>> publicVerify(@PathVariable String code) {
        return ApiResponse.success(traceService.publicVerification(code));
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
