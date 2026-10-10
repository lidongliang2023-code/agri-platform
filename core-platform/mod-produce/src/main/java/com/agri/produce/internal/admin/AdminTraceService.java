package com.agri.produce.internal.admin;

import com.agri.produce.internal.harvest.HarvestBatchEntity;
import com.agri.produce.internal.harvest.HarvestBatchMapper;
import com.agri.produce.internal.quality.InspectionEntity;
import com.agri.produce.internal.quality.InspectionMapper;
import com.agri.produce.internal.quality.QualityLabEntity;
import com.agri.produce.internal.quality.QualityLabMapper;
import com.agri.produce.internal.trace.TraceCodeEntity;
import com.agri.produce.internal.trace.TraceCodeMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
     * <p><b>批次不存在必须失败（G-01 / BT-63）</b>：旧实现在 {@code batch == null} 时整个跳过，
     * 既不写库也不抛异常，直接返回 0，Controller 照样包装成 {@code code=0}，
     * 前端于是宣称「批次已冻结」——而 {@code prod_harvest_batch.status} 根本没变。
     * 这类"刷新列表也不会露馅"的静默无操作是 G-01 里危害最大的一档。
     * 现改为与 {@link AdminQualityService#recall(String)} 完全一致：
     * 查不到即 {@code throw new BusinessException(ErrorCode.NOT_FOUND)}。
     *
     * <p><b>返回值 0 有两义，验收时不可只看数量</b>：
     * 「批次不存在」已改为抛异常，因此**能走到返回值的 0 一定是合法 0**——
     * 批次存在、已冻结，只是该批次名下没有溯源码（{@code batch_no} 为空或无码）。
     * 此时 {@code status} 已被置 4，属于真生效。
     * 所以 G-01 判据里「计数类 → 返回 0 即静默无操作」对本方法**不适用**，
     * 主判据必须是回读 {@code prod_harvest_batch.status == 4}。
     *
     * @param batchId 采收批次ID（prod_harvest_batch.batch_id）
     * @return 作废数量（0 表示批次存在但该批次名下无溯源码，此时批次仍已冻结）
     * @throws BusinessException 批次不存在（{@link ErrorCode#NOT_FOUND}）
     */
    @Transactional
    public int recall(String batchId) {
        HarvestBatchEntity batch = harvestBatchMapper.selectById(batchId);
        if (batch == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        List<TraceCodeEntity> codes = batch.getBatchNo() == null || batch.getBatchNo().isBlank()
                ? new ArrayList<>()
                : traceCodeMapper.selectList(new LambdaQueryWrapper<TraceCodeEntity>()
                        .eq(TraceCodeEntity::getBatchNo, batch.getBatchNo()));
        int count = 0;
        for (TraceCodeEntity traceCode : codes) {
            traceCode.setStatus("revoked");
            traceCodeMapper.updateById(traceCode);
            count++;
        }
        batch.setStatus(4);
        harvestBatchMapper.updateById(batch);
        return count;
    }

    /** 溯源链关联的检测机构 */
    public List<Map<String, Object>> labs() {
        List<QualityLabEntity> labs = qualityLabMapper.selectList(new LambdaQueryWrapper<QualityLabEntity>()
                .eq(QualityLabEntity::getStatus, 1));
        List<Map<String, Object>> result = new ArrayList<>();
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
