package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inspection;
import com.agri.production.entity.TestingLab;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.InspectionMapper;
import com.agri.production.mapper.TestingLabMapper;
import com.agri.production.service.IAdminQualityService;
import com.agri.production.vo.AdminQualityLabVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 运营端质量监管实现。口径对照 core-platform 的 AdminQualityService（本页今天的实现），
 * 按本服务的表落地，并保持几处"可选筛选即不过滤"的约定。
 */
@Slf4j
@Service
public class AdminQualityServiceImpl implements IAdminQualityService {

    private static final int BATCH_STATUS_FROZEN = 4;
    private static final int LAB_STATUS_COOPERATING = 1;
    private static final int LAB_STATUS_TERMINATED = 0;

    private final TestingLabMapper testingLabMapper;
    private final InspectionMapper inspectionMapper;
    private final HarvestBatchMapper harvestBatchMapper;

    public AdminQualityServiceImpl(TestingLabMapper testingLabMapper,
                                   InspectionMapper inspectionMapper,
                                   HarvestBatchMapper harvestBatchMapper) {
        this.testingLabMapper = testingLabMapper;
        this.inspectionMapper = inspectionMapper;
        this.harvestBatchMapper = harvestBatchMapper;
    }

    @Override
    public PageResult<AdminQualityLabVO> pageLabs(int pageNum, int pageSize, String keyword) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<TestingLab> w = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            w.like(TestingLab::getLabName, keyword.trim());
        }
        w.orderByDesc(TestingLab::getCreateTime).orderByDesc(TestingLab::getLabId);
        Page<TestingLab> result = testingLabMapper.selectPage(new Page<>(p, s), w);
        List<AdminQualityLabVO> rows = result.getRecords().stream().map(AdminQualityLabVO::of).toList();
        return PageResult.of(rows, result.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminQualityLabVO accredit(Long labId) {
        TestingLab lab = requireLab(labId);
        lab.setStatus(LAB_STATUS_COOPERATING);
        lab.setUpdateTime(java.time.LocalDateTime.now());
        testingLabMapper.updateById(lab);
        log.info("机构准入认可：labId={} {}", labId, lab.getLabName());
        return AdminQualityLabVO.of(testingLabMapper.selectById(labId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminQualityLabVO reject(Long labId, String rejectReason) {
        TestingLab lab = requireLab(labId);
        lab.setStatus(LAB_STATUS_TERMINATED);
        if (rejectReason != null && !rejectReason.isBlank()) {
            // 只在运营真的填了原因时覆盖；没填就保留历史原因（不因为缺列/缺参把用户输入丢掉）
            lab.setRejectReason(rejectReason.trim());
        }
        lab.setUpdateTime(java.time.LocalDateTime.now());
        testingLabMapper.updateById(lab);
        log.info("机构准入驳回：labId={} {}，原因={}", labId, lab.getLabName(),
                rejectReason == null || rejectReason.isBlank() ? "（未填）" : rejectReason.trim());
        return AdminQualityLabVO.of(testingLabMapper.selectById(labId));
    }

    @Override
    public PageResult<Inspection> pageInspections(int pageNum, int pageSize, String result, String status) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<Inspection> w = new LambdaQueryWrapper<>();
        // 两个筛选都**可选**：列表接口强制要求筛选条件，调用方为了拿全量只能绕过条件，反而丢数据
        if (result != null && !result.isBlank()) {
            w.eq(Inspection::getResult, result.trim().toUpperCase());
        }
        if (status != null && !status.isBlank()) {
            w.eq(Inspection::getStatus, status.trim().toUpperCase());
        }
        w.orderByDesc(Inspection::getSampleAt).orderByDesc(Inspection::getInspectionId);
        Page<Inspection> page = inspectionMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(page.getRecords(), page.getTotal(), p, s);
    }

    @Override
    public List<Inspection> listFailed() {
        return inspectionMapper.selectList(new LambdaQueryWrapper<Inspection>()
                .eq(Inspection::getResult, "FAIL")
                .orderByDesc(Inspection::getSampleAt));
    }

    @Override
    public Map<String, Object> overview() {
        long pass = count("PASS");
        long fail = count("FAIL");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("passCount", pass);
        result.put("failCount", fail);
        // 与 core-platform 同一算法（整数百分比）：换算法会让同一个指标在切流前后跳一下，
        // 那种"数字变了但没人改业务"的差异最难解释
        result.put("passRate", (pass + fail) == 0 ? 0 : pass * 100 / (pass + fail));
        Long labs = testingLabMapper.selectCount(new LambdaQueryWrapper<TestingLab>()
                .eq(TestingLab::getStatus, LAB_STATUS_COOPERATING));
        result.put("labCount", labs == null ? 0L : labs);
        Long frozen = harvestBatchMapper.selectCount(new LambdaQueryWrapper<HarvestBatch>()
                .eq(HarvestBatch::getStatus, BATCH_STATUS_FROZEN));
        result.put("frozenBatch", frozen == null ? 0L : frozen);
        return result;
    }

    private long count(String result) {
        Long hits = inspectionMapper.selectCount(new LambdaQueryWrapper<Inspection>()
                .eq(Inspection::getResult, result));
        return hits == null ? 0L : hits;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> recallBatch(String batchId) {
        Long id = parseBatchId(batchId);
        HarvestBatch batch = harvestBatchMapper.selectById(id);
        if (batch == null) {
            // 与 admin/trace 的召回同一口径：批次不存在必须失败，不能静默返回一个"看起来成功"的空结果
            throw new BusinessException(404, "采收批次不存在：" + batchId);
        }
        batch.setStatus(BATCH_STATUS_FROZEN);
        harvestBatchMapper.updateById(batch);
        log.info("不合格批次召回（冻结）：batchId={} batchNo={}", id, batch.getBatchNo());
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("batchId", batch.getBatchId());
        row.put("batchNo", batch.getBatchNo());
        row.put("status", batch.getStatus());
        return row;
    }

    private TestingLab requireLab(Long labId) {
        if (labId == null) {
            throw new BusinessException(400, "缺少 labId");
        }
        TestingLab lab = testingLabMapper.selectById(labId);
        if (lab == null) {
            throw new BusinessException(404, "检测机构不存在：" + labId);
        }
        return lab;
    }

    private static Long parseBatchId(String batchId) {
        if (batchId == null || batchId.isBlank()) {
            throw new BusinessException(400, "缺少 batchId");
        }
        try {
            return Long.valueOf(batchId.trim());
        } catch (NumberFormatException e) {
            throw new BusinessException(400, "batchId 必须是采收批次的数字主键，收到：" + batchId.trim());
        }
    }
}
