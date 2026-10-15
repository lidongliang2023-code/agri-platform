package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.ChainRecordContractVO;

import java.util.List;
import java.util.Map;

/**
 * 区块链存证（读 + 写）。
 *
 * <p>读路径：分页 / 详情 / 按业务查 / 概览。</p>
 *
 * <p>写路径（提交、按业务存证、重试、验真）已于 2026-10-15 按**模拟链**口径补齐，
 * 语义与边界见各方法注释 —— 核心是：不谎报"已上链"，也不把"本库有记录"说成"链上完整性校验"。</p>
 */
public interface IChainRecordService {

    /**
     * 分页查存证（前端 listChainRecords / listCertRecords 都打这条）。
     *
     * @param status  存证状态 PENDING / SUCCESS / FAILED（可空）
     * @param bizType 业务类型，取存证表 target_type（可空；{@code INSPECTION} 会归一成 {@code QUALITY}）
     * @param keyword 模糊匹配业务键（target_code）与存证记录号（record_no），可空
     */
    PageResult<ChainRecordContractVO> page(int pageNum, int pageSize, String status, String bizType,
                                          String keyword, String tenantId);

    ChainRecordContractVO detail(Long recordId, String tenantId);

    /** 按业务查存证（前端 listBlockchainByBiz：/blockchain/by-biz?bizType=&bizId=）。 */
    List<ChainRecordContractVO> listByBiz(String bizType, String bizId, String tenantId);

    /** 概览：总数 / 本月 / 最新区块高度 / 成功率 / 近七日趋势。 */
    Map<String, Object> overview(String tenantId);

    /* ---------- 写路径（**模拟链**）----------
     *
     * 口径（2026-10-15）：本部署不连真链，这四条按**模拟链**实现，并且
     * 把"模拟链"这个事实写进记录本身（chain_type = SIMULATED）与接口出参，
     * 不做成看起来像真上链 —— 页面/调用方一眼能看出这些存证是模拟产生的。
     */

    /** 提交存证（前端 submitChain，body {bizId, bizType, bizSummary}）。 */
    ChainRecordContractVO submit(String bizId, Integer bizType, String bizSummary, String tenantId);

    /** 按业务存证（前端 anchorRecord，body {bizType, bizNo, traceCode, bizSummary, payloadHash}）。 */
    ChainRecordContractVO anchor(String bizType, String bizNo, String traceCode, String bizSummary,
                                String payloadHash, String tenantId);

    /** 重试上链（前端 retryChain）。已成功的不重试，明确拒绝。 */
    ChainRecordContractVO retry(Long recordId, String tenantId);

    /**
     * 验真（前端 verifyChain / verifyCertificate）。
     *
     * <p>⚠️ 模拟链下这条**只能校验"本库里有没有一条状态为 SUCCESS 的同哈希记录"**，
     * 它证明不了链上数据的完整性 —— 真链验真需要连链做 merkle/回执校验。这一点写在注释与
     * 交付说明里，不靠"返回 true"糊过去。</p>
     */
    boolean verify(String txHash, String certNo, String tenantId);
}
