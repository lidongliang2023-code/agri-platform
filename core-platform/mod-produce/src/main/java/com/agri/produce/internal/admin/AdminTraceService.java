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
        // prod_trace_code.batch_id 是 V1 遗留 BIGINT，与 prod_harvest_batch 的 varchar(32) 主键口径不通
        // （实测 6/6 条溯源码均为合成数字串 9200000000000000xx，按 id 关联命中 0 条，batch 恒为 null）；
        // 真实批次关联存放在 V2 补列的 batch_no 上，故先按 batch_no 关联，关联不到再退回按 id。
        HarvestBatchEntity batch = null;
        if (traceCode.getBatchNo() != null && !traceCode.getBatchNo().isBlank()) {
            List<HarvestBatchEntity> byNo = harvestBatchMapper.selectList(
                    new LambdaQueryWrapper<HarvestBatchEntity>()
                            .eq(HarvestBatchEntity::getBatchNo, traceCode.getBatchNo())
                            .last("LIMIT 1"));
            batch = byNo.isEmpty() ? null : byNo.get(0);
        }
        if (batch == null && traceCode.getBatchId() != null) {
            batch = harvestBatchMapper.selectById(traceCode.getBatchId());
        }
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
     * 口径修正：prod_trace_code.batch_no 存的是「DEMO-BATCHN-004」这类**批次号**，
     * 而入参 batchId 是「DEMO-BATCH-004」这类**批次主键**，二者不同；
     * 旧实现直接 eq(batch_no, batchId) 永远匹配不到（作废恒为 0 张），
     * 但批次冻结仍会执行，导致「只冻结、不作废」的半生效状态。
     * 现改为：先按主键取批次（冻结用），再用该批次的 batchNo 去查溯源码（作废用），两者口径一致。
     *
     * @param batchId 采收批次ID（prod_harvest_batch.batch_id）
     * @return 作废数量
     */
    @Transactional
    public int recall(String batchId) {
        HarvestBatchEntity batch = harvestBatchMapper.selectById(batchId);
        int count = 0;
        if (batch != null) {
            List<TraceCodeEntity> codes = batch.getBatchNo() == null || batch.getBatchNo().isBlank()
                    ? new java.util.ArrayList<>()
                    : traceCodeMapper.selectList(new LambdaQueryWrapper<TraceCodeEntity>()
                            .eq(TraceCodeEntity::getBatchNo, batch.getBatchNo()));
            for (TraceCodeEntity traceCode : codes) {
                traceCode.setStatus("revoked");
                traceCodeMapper.updateById(traceCode);
                count++;
            }
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
