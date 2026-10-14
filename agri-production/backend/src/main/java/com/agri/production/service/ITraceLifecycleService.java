package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.TraceCodeContractVO;

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
}
