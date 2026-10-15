package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IChainRecordService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.ChainRecordContractVO;
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
 * 区块链存证（读）。路径按前端契约 {@code api/blockchain.ts}（BASE = {@code /api/v1/production/blockchain}）。
 *
 * <p>本服务此前**没有**存证控制器，而实体 {@code ChainRecord} / {@code ChainVerifyLog} 早就在
 * （列名与词表都定好了）—— 只是表一直没建。这一轮按实体建表并接上读路径。</p>
 *
 * <p><b>写路径按"模拟链"实现</b>（口径 2026-10-15）：本部署不连真链，四条写接口会真的写库、
 * 真的生成一个带 {@code SIMU} 前缀的模拟交易哈希与自增块高，并把 {@code chainType=SIMULATED}
 * 随出参一起给出 —— 调用方与页面一眼能认出这是模拟存证，而不是"看起来像真上链"。
 * 真链接入时只需换掉 service 里的 {@code simulateChain} 一个方法。</p>
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
            @RequestParam(required = false) String bizType,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(chainRecordService.page(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                status, bizType, keyword, TenantContextService.currentTenantId()));
    }

    /** 分页查询（前端 listCertRecords 走 /blockchain/records）。 */
    @GetMapping("/records")
    public ApiResponse<PageResult<ChainRecordContractVO>> pageByRecordsPath(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String bizType,
            @RequestParam(required = false) String keyword) {
        return page(page, pageNum, size, pageSize, status, bizType, keyword);
    }

    /** 概览（前端 getBlockchainOverview / getChainOverview 都打这条）。 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.success(chainRecordService.overview(TenantContextService.currentTenantId()));
    }

    /**
     * 按业务查存证（前端 listBlockchainByBiz）。
     *
     * <p><b>两个参数名都收</b>：前端契约发的是 {@code bizNo}（api/blockchain.ts 的
     * {@code BlockchainByBizParams}），而本服务早先实现读的是 {@code bizId} ——
     * 名字差一个字母，页面上就是 400「缺少 bizId」，功能整个不可用。
     * 这类"参数名对不上"在切流回归对照里是能抓到的（2026-10-15 就是这么抓到的），
     * 所以这里显式同时接受两个名字，而不是把前端改掉、留一个只有在特定调用方下才对的契约。</p>
     */
    @GetMapping("/by-biz")
    public ApiResponse<List<ChainRecordContractVO>> byBiz(
            @RequestParam(required = false) String bizType,
            @RequestParam(required = false) String bizId,
            @RequestParam(required = false) String bizNo) {
        return ApiResponse.success(chainRecordService.listByBiz(bizType,
                bizNo != null && !bizNo.isBlank() ? bizNo : bizId,
                TenantContextService.currentTenantId()));
    }

    /** 存证详情（前端 getChainRecord / getCertRecord）。 */
    @GetMapping("/{recordId}")
    public ApiResponse<ChainRecordContractVO> detail(@PathVariable Long recordId) {
        return ApiResponse.success(chainRecordService.detail(recordId, TenantContextService.currentTenantId()));
    }

    /* ==================== 写路径（模拟链） ==================== */

    /** 提交存证（前端 submitChain，body {bizId, bizType, bizSummary}）。 */
    @PostMapping("/records")
    public ApiResponse<ChainRecordContractVO> submit(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(chainRecordService.submit(
                str(body.get("bizId")), toInt(body.get("bizType")), str(body.get("bizSummary")),
                TenantContextService.currentTenantId()));
    }

    /** 按业务存证（前端 anchorRecord）。 */
    @PostMapping("/anchor")
    public ApiResponse<ChainRecordContractVO> anchor(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(chainRecordService.anchor(
                str(body.get("bizType")), str(body.get("bizNo")), str(body.get("traceCode")),
                str(body.get("bizSummary")), str(body.get("payloadHash")),
                TenantContextService.currentTenantId()));
    }

    /** 重试上链（前端 retryChain）。 */
    @PatchMapping("/records/{recordId}/retry")
    public ApiResponse<ChainRecordContractVO> retry(@PathVariable Long recordId) {
        return ApiResponse.success(chainRecordService.retry(recordId, TenantContextService.currentTenantId()));
    }

    /** 验真（前端 verifyChain 走 /verify/{txHash}；verifyCertificate 走 /verify?certNo=&txHash=）。 */
    @GetMapping("/verify/{txHash}")
    public ApiResponse<Boolean> verifyByTxHash(@PathVariable String txHash) {
        return ApiResponse.success(chainRecordService.verify(txHash, null,
                TenantContextService.currentTenantId()));
    }

    @GetMapping("/verify")
    public ApiResponse<Boolean> verify(@RequestParam(required = false) String txHash,
                                      @RequestParam(required = false) String certNo) {
        return ApiResponse.success(chainRecordService.verify(txHash, certNo,
                TenantContextService.currentTenantId()));
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static Integer toInt(Object value) {
        String text = str(value);
        if (text == null) {
            return null;
        }
        try {
            return Integer.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
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
