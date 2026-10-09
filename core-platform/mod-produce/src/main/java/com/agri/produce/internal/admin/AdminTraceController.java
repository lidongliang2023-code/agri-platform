package com.agri.produce.internal.admin;

import com.agri.produce.internal.trace.TraceCodeEntity;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：溯源监管（/api/v1/production/admin/trace）。
 */
@RestController
@RequestMapping("/api/v1/production/admin/trace")
@RequiredArgsConstructor
public class AdminTraceController {

    private final AdminTraceService adminTraceService;

    /** 溯源码分页 */
    @GetMapping
    public ApiResponse<PageResult<TraceCodeEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                         @RequestParam(defaultValue = "10") long size,
                                                         @RequestParam(required = false) String status) {
        return ApiResponse.ok(adminTraceService.page(page, size, status));
    }

    /** 码段统计 */
    @GetMapping("/code-stats")
    public ApiResponse<Map<String, Object>> codeStats() {
        return ApiResponse.ok(adminTraceService.codeStats());
    }

    /** 全链条回溯 */
    @GetMapping("/chain")
    public ApiResponse<Map<String, Object>> chain(@RequestParam String code) {
        return ApiResponse.ok(adminTraceService.chain(code));
    }

    /** 一键召回 */
    @PostMapping("/recall")
    public ApiResponse<Integer> recall(@RequestParam String batchId) {
        return ApiResponse.ok(adminTraceService.recall(batchId));
    }

    /** 溯源码列表 */
    @GetMapping("/codes")
    public ApiResponse<PageResult<TraceCodeEntity>> codes(@RequestParam(defaultValue = "1") long page,
                                                          @RequestParam(defaultValue = "10") long size,
                                                          @RequestParam(required = false) String status) {
        return ApiResponse.ok(adminTraceService.page(page, size, status));
    }

    /** 溯源链关联检测机构 */
    @GetMapping("/labs")
    public ApiResponse<List<Map<String, Object>>> labs() {
        return ApiResponse.ok(adminTraceService.labs());
    }

    /** 召回（/recall 的别名） */
    @PostMapping("/recalls")
    public ApiResponse<Integer> recalls(@RequestParam String batchId) {
        return ApiResponse.ok(adminTraceService.recall(batchId));
    }
}
