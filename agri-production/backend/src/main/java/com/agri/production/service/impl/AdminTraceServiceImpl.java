package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.Farm;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inspection;
import com.agri.production.entity.TestingLab;
import com.agri.production.entity.TraceCode;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.InspectionMapper;
import com.agri.production.mapper.TestingLabMapper;
import com.agri.production.mapper.TraceCodeMapper;
import com.agri.production.service.IAdminTraceService;
import com.agri.production.vo.AdminTraceCodeVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 运营端溯源监管实现。口径与 core-platform 的 AdminTraceService 对齐（那是本页今天的实现），
 * 但**按本服务的表结构落地**，并把几处"静默"的口径一并纠正，见各方法注释。
 */
@Slf4j
@Service
public class AdminTraceServiceImpl implements IAdminTraceService {

    /** 批次已冻结（agri_prod_harvest_batch.status 值域：1 在库 2 部分出库 3 清空 4 冻结 5 归档） */
    private static final int BATCH_STATUS_FROZEN = 4;
    /** 码段统计的四个口径 —— 前端就按这四个键取值，键名不能改 */
    private static final List<String> CODE_STATUSES = List.of("generated", "active", "scanned", "revoked");

    private final TraceCodeMapper traceCodeMapper;
    private final HarvestBatchMapper harvestBatchMapper;
    private final InspectionMapper inspectionMapper;
    private final TestingLabMapper testingLabMapper;
    private final FarmMapper farmMapper;

    public AdminTraceServiceImpl(TraceCodeMapper traceCodeMapper,
                                 HarvestBatchMapper harvestBatchMapper,
                                 InspectionMapper inspectionMapper,
                                 TestingLabMapper testingLabMapper,
                                 FarmMapper farmMapper) {
        this.traceCodeMapper = traceCodeMapper;
        this.harvestBatchMapper = harvestBatchMapper;
        this.inspectionMapper = inspectionMapper;
        this.testingLabMapper = testingLabMapper;
        this.farmMapper = farmMapper;
    }

    @Override
    public PageResult<AdminTraceCodeVO> pageCodes(int pageNum, int pageSize, String status) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<TraceCode> w = new LambdaQueryWrapper<>();
        if (status != null && !status.isBlank()) {
            String normalized = AdminTraceCodeVO.normalizeStatus(status);
            // 库里的历史值可能是 inactive，而归一后它等于 generated —— 只按字面等值筛会漏掉这些行
            if ("generated".equals(normalized)) {
                w.in(TraceCode::getStatus, "generated", "inactive");
            } else {
                w.eq(TraceCode::getStatus, normalized);
            }
        }
        w.orderByDesc(TraceCode::getCreateTime).orderByDesc(TraceCode::getId);
        Page<TraceCode> result = traceCodeMapper.selectPage(new Page<>(p, s), w);
        List<AdminTraceCodeVO> rows = result.getRecords().stream().map(AdminTraceCodeVO::of).toList();
        return PageResult.of(rows, result.getTotal(), p, s);
    }

    @Override
    public Map<String, Object> codeStats() {
        // 逐个状态查计数：拿总数去减会算出一个既不是"已生成"也不是"已作废"的数
        Map<String, Object> result = new LinkedHashMap<>();
        for (String status : CODE_STATUSES) {
            LambdaQueryWrapper<TraceCode> w = new LambdaQueryWrapper<>();
            if ("generated".equals(status)) {
                w.in(TraceCode::getStatus, "generated", "inactive");
            } else {
                w.eq(TraceCode::getStatus, status);
            }
            Long hits = traceCodeMapper.selectCount(w);
            result.put(status, hits == null ? 0L : hits);
        }
        return result;
    }

    @Override
    public Map<String, Object> chain(String code) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (code == null || code.isBlank()) {
            throw new BusinessException(400, "缺少溯源码（code）");
        }
        List<TraceCode> codes = traceCodeMapper.selectList(new LambdaQueryWrapper<TraceCode>()
                .eq(TraceCode::getTraceCode, code.trim()).last("LIMIT 1"));
        if (codes.isEmpty()) {
            // 查不到就只说查不到：不塞 batch/inspections 的空壳，前端按 found=false 渲染"无记录"
            result.put("found", false);
            return result;
        }
        TraceCode traceCode = codes.get(0);
        result.put("found", true);
        result.put("traceCode", AdminTraceCodeVO.of(traceCode));

        // 批次关联以 **batch_no** 为准：溯源码表的 harvest_id 指向旧表的数字主键，
        // 与采收批次的 id 不是一套（core-platform 那边踩过同样的坑，注释里写着"按 id 命中 0 条"）
        HarvestBatch batch = null;
        if (traceCode.getBatchNumber() != null && !traceCode.getBatchNumber().isBlank()) {
            List<HarvestBatch> byNo = harvestBatchMapper.selectList(new LambdaQueryWrapper<HarvestBatch>()
                    .eq(HarvestBatch::getBatchNo, traceCode.getBatchNumber()).last("LIMIT 1"));
            batch = byNo.isEmpty() ? null : byNo.get(0);
        }
        if (batch == null && traceCode.getHarvestId() != null) {
            batch = harvestBatchMapper.selectById(traceCode.getHarvestId());
        }
        result.put("batch", batchSnapshot(batch));
        result.put("inspections", batch == null ? List.of() : inspectionsOf(batch));
        return result;
    }

    /** 批次快照：字段名按前端 AdminTraceChainBatch，farmName 由本地农场表补（补不到就是 null） */
    private Map<String, Object> batchSnapshot(HarvestBatch batch) {
        if (batch == null) {
            return null;
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("batchId", batch.getBatchId());
        row.put("batchNo", batch.getBatchNo());
        row.put("cropName", batch.getCropName());
        row.put("plotId", batch.getPlotId());
        row.put("harvestDate", batch.getHarvestDate());
        row.put("quantity", batch.getQuantity());
        row.put("unit", batch.getUnit());
        row.put("status", batch.getStatus());
        row.put("farmName", farmNameOf(batch.getFarmId()));
        return row;
    }

    private List<Inspection> inspectionsOf(HarvestBatch batch) {
        return inspectionMapper.selectList(new LambdaQueryWrapper<Inspection>()
                .eq(Inspection::getBatchId, batch.getBatchId())
                .orderByDesc(Inspection::getInspectionId));
    }

    private String farmNameOf(Long farmId) {
        if (farmId == null) {
            return null;
        }
        Farm farm = farmMapper.selectById(farmId);
        return farm == null ? null : farm.getFarmName();
    }

    @Override
    public List<Map<String, Object>> labs() {
        List<TestingLab> labs = testingLabMapper.selectList(new LambdaQueryWrapper<TestingLab>()
                .eq(TestingLab::getStatus, 1));
        List<Map<String, Object>> result = new ArrayList<>();
        for (TestingLab lab : labs) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("labId", lab.getLabId());
            row.put("labName", lab.getLabName());
            // 本服务没有 lab_type 列 → null（不编），qualificationNo 取已有的 cert_no
            row.put("labType", null);
            row.put("qualificationNo", lab.getCertNo());
            result.add(row);
        }
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int recall(String batchId) {
        Long id = parseBatchId(batchId);
        HarvestBatch batch = harvestBatchMapper.selectById(id);
        if (batch == null) {
            // 批次不存在必须失败：静默返回 0 会让前端宣称"批次已冻结"，而库里什么都没变
            throw new BusinessException(404, "采收批次不存在：" + batchId);
        }
        List<TraceCode> codes = batch.getBatchNo() == null || batch.getBatchNo().isBlank()
                ? List.of()
                : traceCodeMapper.selectList(new LambdaQueryWrapper<TraceCode>()
                        .eq(TraceCode::getBatchNumber, batch.getBatchNo()));
        int revoked = 0;
        for (TraceCode code : codes) {
            if ("revoked".equals(AdminTraceCodeVO.normalizeStatus(code.getStatus()))) {
                continue;
            }
            code.setStatus("revoked");
            code.setUpdateTime(java.time.LocalDateTime.now());
            traceCodeMapper.updateById(code);
            revoked++;
        }
        batch.setStatus(BATCH_STATUS_FROZEN);
        harvestBatchMapper.updateById(batch);
        log.info("一键召回：批次 {}({}) 冻结，作废溯源码 {} 张", batch.getBatchNo(), id, revoked);
        return revoked;
    }

    private static Long parseBatchId(String batchId) {
        if (batchId == null || batchId.isBlank()) {
            throw new BusinessException(400, "缺少 batchId");
        }
        try {
            return Long.valueOf(batchId.trim());
        } catch (NumberFormatException e) {
            // 说清楚收到的是什么，别让调用方去猜该传哪种 id
            throw new BusinessException(400, "batchId 必须是采收批次的数字主键，收到：" + batchId.trim());
        }
    }
}
