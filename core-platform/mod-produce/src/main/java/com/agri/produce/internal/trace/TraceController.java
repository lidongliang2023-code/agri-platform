package com.agri.produce.internal.trace;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 溯源码接口（路径按 PRD 5.1 迁移至 /api/v1/production/trace）。
 */
@RestController
@RequestMapping("/api/v1/production/trace")
@RequiredArgsConstructor
public class TraceController {

    private final TraceService traceService;

    /** 分页查询溯源码 */
    @GetMapping
    public ApiResponse<PageResult<TraceCodeEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                         @RequestParam(defaultValue = "10") long size,
                                                         @RequestParam(required = false) String status) {
        return ApiResponse.ok(traceService.page(page, size, status));
    }

    /** 溯源码详情 */
    @GetMapping("/{code}")
    public ApiResponse<TraceCodeEntity> detail(@PathVariable String code) {
        return ApiResponse.ok(traceService.detail(code));
    }

    /** 为批次生成溯源码（采收后可调用；交易商品随 batch.harvested 事件挂载批次溯源标识） */
    @PostMapping("/batches/{batchId}/generate")
    public ApiResponse<String> generate(@PathVariable Long batchId) {
        return ApiResponse.ok(traceService.generate(batchId));
    }

    /** 旧路径兼容：/api/v1/production/batches/{id}/trace-code 语义 */
    @PostMapping("/batches/{batchId}/trace-code")
    public ApiResponse<String> generateLegacy(@PathVariable Long batchId) {
        return ApiResponse.ok(traceService.generate(batchId));
    }

    /** 激活溯源码 → 发布 prod.trace.activated */
    @PostMapping("/activate")
    public ApiResponse<TraceCodeEntity> activate(@RequestParam String code,
                                                 @RequestParam(required = false) String activatedBy) {
        return ApiResponse.ok(traceService.activate(code, activatedBy));
    }

    /** 扫码（累计次数） */
    @PostMapping("/scan")
    public ApiResponse<TraceCodeEntity> scan(@RequestParam String code) {
        return ApiResponse.ok(traceService.scan(code));
    }

    /** 作废溯源码（召回场景） */
    @PostMapping("/{code}/revoke")
    public ApiResponse<TraceCodeEntity> revoke(@PathVariable String code) {
        return ApiResponse.ok(traceService.revoke(code));
    }

    /** 批次下的溯源码 */
    @GetMapping("/batches/{batchId}")
    public ApiResponse<List<TraceCodeEntity>> listByBatch(@PathVariable Long batchId) {
        return ApiResponse.ok(traceService.listByBatch(batchId));
    }

    /** 溯源码列表 */
    @GetMapping("/codes")
    public ApiResponse<PageResult<TraceCodeEntity>> codes(@RequestParam(defaultValue = "1") long page,
                                                          @RequestParam(defaultValue = "10") long size,
                                                          @RequestParam(required = false) String status) {
        return ApiResponse.ok(traceService.page(page, size, status));
    }

    /** 生成溯源码 */
    @PostMapping("/codes/generate")
    public ApiResponse<String> generateCodes(@RequestParam Long batchId) {
        return ApiResponse.ok(traceService.generate(batchId));
    }

    /** 全链条节点 */
    @GetMapping("/full-chain/{batchId}/nodes")
    public ApiResponse<List<Map<String, Object>>> fullChain(@PathVariable Long batchId) {
        return ApiResponse.ok(traceService.fullChain(batchId));
    }
}
