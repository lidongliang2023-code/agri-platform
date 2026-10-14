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

    PageResult<TraceCodeContractVO> page(int pageNum, int pageSize, String status, String tenantId);

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

    List<TraceCodeContractVO> listByBatch(String batchId, String tenantId);

    /**
     * 全链路节点（前端 {@code GET /trace/full-chain/{batchId}/nodes}，契约 {@code TraceFullChainNode}）。
     *
     * <p><b>派生，不建表</b>：节点从各域**已有的真实数据**聚合而来 —— 采收批次本身、
     * 该批次的质检单、该批次的库存流水、该地块的投入品使用记录、该批次的溯源码。
     * 哪个域没有数据，就没有那一段节点（不补空节点、不编时间）。</p>
     */
    List<Map<String, Object>> fullChainNodes(String batchId, String tenantId);

    /**
     * 按溯源码取全链路（前端 {@code GET /trace/full-chain/trace/{code}}，契约 {@code TraceNode}）。
     *
     * <p>先按码找到批次，再走与 {@link #fullChainNodes} 同一套聚合；
     * 契约里多出来的 {@code nodeId}/{@code nodeName} 由阶段+引用号拼出，{@code onChain}
     * 只在真有交易哈希时为 true（没有存证记录就是 false，不猜）。</p>
     */
    List<Map<String, Object>> fullChainByCode(String code, String tenantId);
}
