package com.agri.produce.internal.batch;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

/**
 * 批次接口：建批 / 采收 / 列表。
 */
@RestController
@RequestMapping("/api/v1/production/batches")
@RequiredArgsConstructor
public class BatchController {

    private final BatchService batchService;

    public record CreateBatchRequest(@NotNull Long plotId, @NotNull Long productId, BigDecimal quantity) {
    }

    @GetMapping
    public ApiResponse<PageResult<BatchEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                     @RequestParam(defaultValue = "10") long size,
                                                     @RequestParam(required = false) String status) {
        return ApiResponse.ok(batchService.page(page, size, status));
    }

    @PostMapping
    public ApiResponse<Long> create(@Valid @RequestBody CreateBatchRequest req) {
        return ApiResponse.ok(batchService.create(req.plotId(), req.productId(), req.quantity()).getId());
    }

    /** 采收：触发 batch.harvested 事件 → 交易域挂载溯源码 */
    @PostMapping("/{id}/harvest")
    public ApiResponse<BatchEntity> harvest(@PathVariable Long id) {
        return ApiResponse.ok(batchService.harvest(id));
    }
}
