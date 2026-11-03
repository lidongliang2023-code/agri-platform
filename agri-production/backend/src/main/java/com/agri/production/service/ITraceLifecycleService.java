package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.TraceCodeContractVO;

import java.util.Map;
import java.util.List;

/**
 * 溯源码生命周期（前端 {@code api/trace.ts} 契约）。
 *
 * <p>与既有的 {@code ITraceCodeService} 并存但不重叠：那个是旧路径（/trace/generate、
 * /trace/query/{code}）的实现，前端一条都不调；这里是契约路径的实现。</p>
 */
public interface ITraceLifecycleService {

    /**
     * 溯源码分页。
     *
     * <p>筛选一律在**服务端**完成（{@link TraceCodeFilter}）：以前关键字、农场是前端在已取回的
     * 那一页里过滤，搜到不在本页的码就显示"没有"，而分页总数还是没筛的数。
     * 农场条件此前比的是出参里不存在的 {@code farmId}，从来没生效过。</p>
     */
    PageResult<TraceCodeContractVO> page(int pageNum, int pageSize, TraceCodeFilter filter, String tenantId);

    TraceCodeContractVO detail(String code, String tenantId);

    /** 为批次生成一个新码（一个批次可以有多个码），返回新码。 */
    String generate(String batchId, String expireDate, String tenantId);

    /** 激活：generated → active。 */
    TraceCodeContractVO activate(String code, String activatedBy, String tenantId);

    /** 扫码：累计查询次数、记首次查询时间、状态进 scanned。 */
    TraceCodeContractVO scan(String code, String tenantId);

    /** 作废：→ revoked。 */
    TraceCodeContractVO revoke(String code, String tenantId);

    /** 批量激活 / 批量作废；返回实际生效条数。 */
    int batchUpdateStatus(List<String> codes, String targetStatus, String tenantId);

    /**
     * 到期扫描：把过了"有效期至"且仍是 generated/active/scanned 的码置为 expired，返回条数。
     *
     * <p>{@code tenantId} 传空 = 扫全部主体（定时任务用）；传值 = 只扫该主体（页面手动触发用）。
     * 没设有效期的码不参与，不拿别的日期编一个到期日。</p>
     */
    int expireOverdue(String tenantId);

    List<TraceCodeContractVO> listByBatch(String batchId, String tenantId);

    /**
     * 全链路节点（前端 {@code GET /trace/full-chain/{batchId}/nodes}，契约 {@code TraceFullChainNode}）。
     *
     * <p><b>派生，不建表</b>：节点从各域**已有的真实数据**聚合而来 —— 采收批次本身、
     * 该批次的质检单、该批次的库存流水、该地块的投入品使用记录、该批次的溯源码。
     * 哪个域没有数据，就没有那一段节点（不补空节点、不编时间）。</p>
     *
     * <p>每个节点还带链上凭证：{@code attested/onChain/chainStatus/chainType/recordNo/txHash/
     * blockNumber/chainTime/failedReason}，一律按 {@code agri_prod_chain_record} 的真实记录判定
     * （SUCCESS 才算 onChain）。<b>这里曾经是假的</b>：采收节点写的是"批次有没有溯源码"、
     * 其余节点一律 false、txHash 没人填 —— 与核验视图给出过两个不同结论，2026-11-01 收口成同源。</p>
     */
    List<Map<String, Object>> fullChainNodes(String batchId, String tenantId);

    /**
     * 按溯源码取全链路（前端 {@code GET /trace/full-chain/trace/{code}}，契约 {@code TraceNode}）。
     *
     * <p>先按码找到批次，再走与 {@link #fullChainNodes} 同一套聚合（含同一套链上判定）；
     * 契约里多出来的 {@code nodeId}/{@code nodeName} 由阶段+引用号拼出。</p>
     */
    List<Map<String, Object>> fullChainByCode(String code, String tenantId);

    /**
     * 溯源核验视图（{@code GET /trace/public/verify/{code}}）：**跨主体**、只给核验要用的字段。
     *
     * <p>与 {@link #fullChainByCode} 的差别只有两处（链上口径与"已删码取不到"两处都相同）：</p>
     * <ul>
     *   <li>不按调用方主体过滤 —— 核验时手上只有码，没有属主令牌；</li>
     *   <li>出参形状按核验需要裁剪，另给码本身的存证 {@code selfAttestation} 与
     *       {@code nodeCount/onChainCount/attestedCount/chainConclusion} 汇总，
     *       以及"码状态是否可核验"的 {@code verifiable}。</li>
     * </ul>
     */
    Map<String, Object> publicVerification(String code);
}
