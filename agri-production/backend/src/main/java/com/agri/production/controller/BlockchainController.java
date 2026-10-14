package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IChainRecordService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.ChainRecordContractVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 区块链存证（读）。路径按前端契约 {@code api/blockchain.ts}（BASE = {@code /api/v1/production/blockchain}）。
 *
 * <p>本服务此前**没有**存证控制器，而实体 {@code ChainRecord} / {@code ChainVerifyLog} 早就在
 * （列名与词表都定好了）—— 只是表一直没建。这一轮按实体建表并接上读路径。</p>
 *
 * <p><b>写路径（POST /records 提交、POST /anchor 存证、PATCH /records/{id}/retry 重试、
 * GET /verify[/{txHash}] 验真）留到下一轮</b>：它们牵动"链上交互"这件事（真链还是模拟链），
 * 需要先定口径 —— 在这之前不做一个"返回成功但什么也没上链"的假实现。</p>
 */
@RestController
@RequestMapping("/api/v1/production/blockchain")
public class BlockchainController {

    private final IChainRecordService chainRecordService;

    public BlockchainController(IChainRecordService chainRecordService) {
        this.chainRecordService = chainRecordService;
    }

    /** 分页查询存证记录（前端 listChainRecords / listCertRecords 都打这条）。 */
    @GetMapping
    public ApiResponse<PageResult<ChainRecordContractVO>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String bizType) {
        return ApiResponse.success(chainRecordService.page(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                status, bizType, TenantContextService.currentTenantId()));
    }

    /** 分页查询（前端 listCertRecords 走 /blockchain/records）。 */
    @GetMapping("/records")
    public ApiResponse<PageResult<ChainRecordContractVO>> pageByRecordsPath(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String bizType) {
        return page(page, pageNum, size, pageSize, status, bizType);
    }

    /** 概览（前端 getBlockchainOverview / getChainOverview 都打这条）。 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.success(chainRecordService.overview(TenantContextService.currentTenantId()));
    }

    /** 按业务查存证（前端 listBlockchainByBiz）。 */
    @GetMapping("/by-biz")
    public ApiResponse<List<ChainRecordContractVO>> byBiz(
            @RequestParam(required = false) String bizType,
            @RequestParam(required = false) String bizId) {
        return ApiResponse.success(chainRecordService.listByBiz(bizType, bizId,
                TenantContextService.currentTenantId()));
    }

    /** 存证详情（前端 getChainRecord / getCertRecord）。 */
    @GetMapping("/{recordId}")
    public ApiResponse<ChainRecordContractVO> detail(@PathVariable Long recordId) {
        return ApiResponse.success(chainRecordService.detail(recordId, TenantContextService.currentTenantId()));
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
