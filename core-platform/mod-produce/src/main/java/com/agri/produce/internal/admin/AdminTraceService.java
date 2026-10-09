package com.agri.produce.internal.admin;

import com.agri.produce.internal.harvest.HarvestBatchEntity;
import com.agri.produce.internal.harvest.HarvestBatchMapper;
import com.agri.produce.internal.quality.InspectionEntity;
import com.agri.produce.internal.quality.InspectionMapper;
import com.agri.produce.internal.trace.TraceCodeEntity;
import com.agri.produce.internal.trace.TraceCodeMapper;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import com.agri.produce.internal.quality.QualityLabEntity;
import com.agri.produce.internal.quality.QualityLabMapper;

/**
 * 运营端：溯源监管与召回（码段统计、全链条回溯、一键召回）。
 */
@Service
@RequiredArgsConstructor
public class AdminTraceService {

    private final TraceCodeMapper traceCodeMapper;
    private final QualityLabMapper qualityLabMapper;
    private final HarvestBatchMapper harvestBatchMapper;
    private final InspectionMapper inspectionMapper;

    /**
     * 溯源码分页监管。
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
     * 码段统计：按状态维度汇总。
     *
     * @return 状态 → 数量
     */
    public Map<String, Object> codeStats() {
        Map<String, Object> result = new LinkedHashMap<>();
        for (String status : List.of("generated", "active", "scanned", "revoked")) {
            result.put(status, traceCodeMapper.selectCount(new LambdaQueryWrapper<TraceCodeEntity>()
                    .eq(TraceCodeEntity::getStatus, status)));
        }
        return result;
    }

    /**
     * 全链条回溯：码 → 批次 → 质检。
     *
     * @param code 溯源码
     * @return 链路快照
     */
    public Map<String, Object> chain(String code) {
        List<TraceCodeEntity> codes = traceCodeMapper.selectList(new LambdaQueryWrapper<TraceCodeEntity>()
                .eq(TraceCodeEntity::getCode, code)
                .last("LIMIT 1"));
        Map<String, Object> result = new LinkedHashMap<>();
        if (codes.isEmpty()) {
            result.put("found", false);
            return result;
        }
        TraceCodeEntity traceCode = codes.get(0);
        result.put("found", true);
        result.put("traceCode", traceCode);
        HarvestBatchEntity batch = traceCode.getBatchId() == null
                ? null : harvestBatchMapper.selectById(traceCode.getBatchId());
        result.put("batch", batch);
        if (batch != null) {
            result.put("inspections", inspectionMapper.selectList(new LambdaQueryWrapper<InspectionEntity>()
                    .eq(InspectionEntity::getBatchId, batch.getBatchId())));
        }
        return result;
    }

    /**
     * 一键召回：作废批次下全部溯源码并冻结批次。
     *
     * @param batchId 采收批次ID
     * @return 作废数量
     */
    @Transactional
    public int recall(String batchId) {
        List<TraceCodeEntity> codes = traceCodeMapper.selectList(new LambdaQueryWrapper<TraceCodeEntity>()
                .eq(TraceCodeEntity::getBatchNo, batchId));
        int count = 0;
        for (TraceCodeEntity traceCode : codes) {
            traceCode.setStatus("revoked");
            traceCodeMapper.updateById(traceCode);
            count++;
        }
        HarvestBatchEntity batch = harvestBatchMapper.selectById(batchId);
        if (batch != null) {
            batch.setStatus(4);
            harvestBatchMapper.updateById(batch);
        }
        return count;
    }

    /** 溯源链关联的检测机构 */
    public List<Map<String, Object>> labs() {
        List<QualityLabEntity> labs = qualityLabMapper.selectList(new LambdaQueryWrapper<QualityLabEntity>()
                .eq(QualityLabEntity::getStatus, 1));
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (QualityLabEntity lab : labs) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("labId", lab.getLabId());
            row.put("labName", lab.getLabName());
            row.put("labType", lab.getLabType());
            row.put("qualificationNo", lab.getQualificationNo());
            result.add(row);
        }
        return result;
    }
}
