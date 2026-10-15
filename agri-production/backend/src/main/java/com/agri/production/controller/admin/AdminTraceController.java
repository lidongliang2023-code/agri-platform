package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IAdminTraceService;
import com.agri.production.vo.AdminTraceCodeVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：溯源监管（{@code /api/v1/production/admin/trace}）。
 *
 * <p>路径按前端契约 {@code api/admin/trace.ts} 逐条对齐，且**只实现页面真的会调的那些** ——
 * 那个文件原先还带着 16 个"没有任何页面调用、后端任何服务也没有实现"的函数
 * （getTraceOverview / getAdminTraceCode / freezeTraceCode / listAdminTraceNodes /
 * labs 增删改查 / recalls 增删改查 / fetchChainLabs），它们让"该段缺口"看起来有 13 条，
 * 实际活的是 4 条。这些死函数已随本轮一起删掉，理由与删后端脚手架一致：
 * 判据要盯的是"页面会碎的路径"，把从不发出的请求算成缺口，只会让缺口永远归不了零。</p>
 *
 * <p>本控制器的接口**不做租户过滤**，理由见 {@link IAdminTraceService}。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/trace")
public class AdminTraceController {

    private final IAdminTraceService adminTraceService;

    public AdminTraceController(IAdminTraceService adminTraceService) {
        this.adminTraceService = adminTraceService;
    }

    /** 溯源码分页（core-platform 有一个同口径的 {@code GET /admin/trace}，这里保留以免口径分叉）。 */
    @GetMapping
    public ApiResponse<PageResult<AdminTraceCodeVO>> page(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(adminTraceService.pageCodes(page, size, status));
    }

    /** 溯源码分页（页面 {@code AdminTraceCodeManage} 走这条）。 */
    @GetMapping("/codes")
    public ApiResponse<PageResult<AdminTraceCodeVO>> codes(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(adminTraceService.pageCodes(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), status));
    }

    /** 码段统计（页面 {@code TraceOverview} 走这条）。 */
    @GetMapping("/code-stats")
    public ApiResponse<Map<String, Object>> codeStats() {
        return ApiResponse.success(adminTraceService.codeStats());
    }

    /** 全链条回溯（页面 {@code Detail} 走这条）。 */
    @GetMapping("/chain")
    public ApiResponse<Map<String, Object>> chain(@RequestParam(required = false) String code) {
        return ApiResponse.success(adminTraceService.chain(code));
    }

    /** 溯源链关联的检测机构。 */
    @GetMapping("/labs")
    public ApiResponse<List<Map<String, Object>>> labs() {
        return ApiResponse.success(adminTraceService.labs());
    }

    /**
     * 一键召回：作废批次下全部溯源码并冻结批次。
     *
     * <p>{@code /recalls} 是别名 —— core-platform 上两条都在（历史叫法），保留同样的两条，
     * 避免切流后某个还在用旧名的调用方 404。</p>
     */
    @PostMapping("/recall")
    public ApiResponse<Integer> recall(@RequestParam(required = false) String batchId) {
        return ApiResponse.success(adminTraceService.recall(batchId));
    }

    @PostMapping("/recalls")
    public ApiResponse<Integer> recalls(@RequestParam(required = false) String batchId) {
        return ApiResponse.success(adminTraceService.recall(batchId));
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
