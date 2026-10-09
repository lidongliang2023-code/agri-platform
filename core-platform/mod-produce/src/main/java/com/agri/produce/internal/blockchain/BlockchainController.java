package com.agri.produce.internal.blockchain;

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
 * 区块链存证（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/blockchain")
@RequiredArgsConstructor
public class BlockchainController {

    private final BlockchainRecordService blockchainRecordService;

    @GetMapping
    public ApiResponse<PageResult<BlockchainRecordEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                                @RequestParam(defaultValue = "10") long size,
                                                                @RequestParam(required = false) String keyword,
                                                                @RequestParam(required = false) String status) {
        return ApiResponse.ok(blockchainRecordService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<BlockchainRecordEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(blockchainRecordService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody BlockchainRecordEntity entity) {
        return ApiResponse.ok(blockchainRecordService.create(entity).getRecordId());
    }

    @PutMapping("/{id}")
    public ApiResponse<BlockchainRecordEntity> update(@PathVariable String id, @RequestBody BlockchainRecordEntity entity) {
        return ApiResponse.ok(blockchainRecordService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        blockchainRecordService.delete(id);
        return ApiResponse.ok();
    }

    /** 上链存证 */
    @PostMapping("/anchor")
    public ApiResponse<BlockchainRecordEntity> anchor(@RequestBody BlockchainRecordEntity record) {
        return ApiResponse.ok(blockchainRecordService.anchor(record));
    }

    /** 按业务单号查询存证 */
    @GetMapping("/by-biz")
    public ApiResponse<List<BlockchainRecordEntity>> byBiz(@RequestParam(required = false) String bizType,
                                                           @RequestParam(required = false) String bizNo) {
        return ApiResponse.ok(blockchainRecordService.listByBiz(bizType, bizNo));
    }

    /** 存证校验 */
    @GetMapping("/verify")
    public ApiResponse<Boolean> verify(@RequestParam String txHash) {
        return ApiResponse.ok(blockchainRecordService.verify(txHash));
    }

    /** 存证记录列表 */
    @GetMapping("/records")
    public ApiResponse<PageResult<BlockchainRecordEntity>> records(@RequestParam(defaultValue = "1") long page,
                                                                   @RequestParam(defaultValue = "10") long size,
                                                                   @RequestParam(required = false) String keyword,
                                                                   @RequestParam(required = false) String status) {
        return ApiResponse.ok(blockchainRecordService.page(page, size, keyword, status));
    }

    /** 按交易哈希校验 */
    @GetMapping("/verify/{txHash}")
    public ApiResponse<Boolean> verifyByHash(@PathVariable String txHash) {
        return ApiResponse.ok(blockchainRecordService.verify(txHash));
    }

    /** 存证总览 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.ok(blockchainRecordService.overview());
    }
}
