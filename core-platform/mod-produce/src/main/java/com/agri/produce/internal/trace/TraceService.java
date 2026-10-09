package com.agri.produce.internal.trace;

import com.agri.core.infra.event.DomainEventPublisher;
import com.agri.produce.api.event.ProduceEvents;
import com.agri.produce.internal.batch.BatchEntity;
import com.agri.produce.internal.batch.BatchMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 溯源码服务：生成 / 激活 / 扫码 / 作废，支撑「一物一码」贯穿交易与监管。
 */
@Service
@RequiredArgsConstructor
public class TraceService {

    private final TraceCodeMapper traceCodeMapper;
    private final BatchMapper batchMapper;
    private final DomainEventPublisher eventPublisher;

    /**
     * 为已采收批次生成一物一码（初始状态 generated）。
     *
     * @param batchId 批次ID
     * @return 溯源码
     */
    @Transactional
    public String generate(Long batchId) {
        BatchEntity batch = batchMapper.selectById(batchId);
        if (batch == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        Long exists = traceCodeMapper.selectCount(new LambdaQueryWrapper<TraceCodeEntity>()
                .eq(TraceCodeEntity::getBatchId, batchId));
        if (exists > 0) {
            throw new BusinessException(ErrorCode.TRACE_CODE_DUPLICATED);
        }
        String code = "TRC" + batch.getBatchCode() + ThreadLocalRandom.current().nextInt(100, 999);
        TraceCodeEntity traceCode = new TraceCodeEntity();
        traceCode.setBatchId(batchId);
        traceCode.setBatchNo(batch.getBatchCode());
        traceCode.setCode(code);
        traceCode.setStatus("generated");
        traceCode.setScanCount(0);
        traceCodeMapper.insert(traceCode);
        return code;
    }

    /**
     * 分页查询溯源码。
     *
     * @param page   页码
     * @param size   每页条数
     * @param status 状态过滤
     * @return 分页结果
     */
    public PageResult<TraceCodeEntity> page(long page, long size, String status) {
        Page<TraceCodeEntity> result = traceCodeMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<TraceCodeEntity>()
                        .eq(status != null && !status.isBlank(), TraceCodeEntity::getStatus, status)
                        .orderByDesc(TraceCodeEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 按溯源码查询详情。
     *
     * @param code 溯源码
     * @return 溯源档案
     */
    public TraceCodeEntity detail(String code) {
        List<TraceCodeEntity> list = traceCodeMapper.selectList(new LambdaQueryWrapper<TraceCodeEntity>()
                .eq(TraceCodeEntity::getCode, code)
                .last("LIMIT 1"));
        if (list.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return list.get(0);
    }

    /**
     * 激活溯源码：generated → active，并发布 prod.trace.activated。
     *
     * @param code        溯源码
     * @param activatedBy 激活人
     * @return 溯源档案
     */
    @Transactional
    public TraceCodeEntity activate(String code, String activatedBy) {
        TraceCodeEntity traceCode = detail(code);
        if ("revoked".equals(traceCode.getStatus())) {
            throw new BusinessException(ErrorCode.BIZ_ERROR);
        }
        traceCode.setStatus("active");
        traceCode.setActivatedAt(LocalDateTime.now());
        traceCode.setActivatedBy(activatedBy);
        traceCodeMapper.updateById(traceCode);

        eventPublisher.publish(ProduceEvents.PROD_TRACE_ACTIVATED, code,
                new ProduceEvents.TraceActivated(code, String.valueOf(traceCode.getBatchId()),
                        traceCode.getBatchNo(), activatedBy, traceCode.getMarketId(),
                        traceCode.getActivatedAt().toString()));
        return traceCode;
    }

    /**
     * 扫码：累计扫码次数并刷新最后扫码时间。
     *
     * @param code 溯源码
     * @return 溯源档案
     */
    @Transactional
    public TraceCodeEntity scan(String code) {
        TraceCodeEntity traceCode = detail(code);
        traceCode.setScanCount(traceCode.getScanCount() == null ? 1 : traceCode.getScanCount() + 1);
        traceCode.setLastScanAt(LocalDateTime.now());
        if ("active".equals(traceCode.getStatus())) {
            traceCode.setStatus("scanned");
        }
        traceCodeMapper.updateById(traceCode);
        return traceCode;
    }

    /**
     * 作废溯源码（召回场景）。
     *
     * @param code 溯源码
     * @return 溯源档案
     */
    @Transactional
    public TraceCodeEntity revoke(String code) {
        TraceCodeEntity traceCode = detail(code);
        traceCode.setStatus("revoked");
        traceCodeMapper.updateById(traceCode);
        return traceCode;
    }

    /**
     * 批次下的溯源码清单。
     *
     * @param batchId 批次ID
     * @return 溯源码列表
     */
    public List<TraceCodeEntity> listByBatch(Long batchId) {
        return traceCodeMapper.selectList(new LambdaQueryWrapper<TraceCodeEntity>()
                .eq(TraceCodeEntity::getBatchId, batchId)
                .orderByDesc(TraceCodeEntity::getCreatedAt));
    }

    /** 全链条节点：批次 → 溯源码 → 激活/扫码 */
    public List<Map<String, Object>> fullChain(Long batchId) {
        List<Map<String, Object>> nodes = new java.util.ArrayList<>();
        BatchEntity batch = batchMapper.selectById(batchId);
        if (batch != null) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("nodeType", "BATCH");
            node.put("nodeName", "采收批次");
            node.put("refId", String.valueOf(batch.getId()));
            node.put("refNo", batch.getBatchCode());
            node.put("occurredAt", batch.getHarvestAt());
            nodes.add(node);
        }
        for (TraceCodeEntity code : listByBatch(batchId)) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("nodeType", "TRACE_CODE");
            node.put("nodeName", "溯源码");
            node.put("refId", String.valueOf(code.getId()));
            node.put("refNo", code.getCode());
            node.put("occurredAt", code.getActivatedAt() == null ? code.getCreatedAt() : code.getActivatedAt());
            nodes.add(node);
        }
        return nodes;
    }
}
