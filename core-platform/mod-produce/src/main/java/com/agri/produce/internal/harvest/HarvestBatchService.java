package com.agri.produce.internal.harvest;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 采收批次（溯源主链：地块 → 采收 → 检测 → 批次 → 溯源码） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class HarvestBatchService {

    private static final String ID_PREFIX = "HBT";

    private final HarvestBatchMapper harvestBatchMapper;

    /**
     * 分页查询。
     *
     * @param keyword batchNo 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<HarvestBatchEntity> page(long page, long size, String keyword, Integer status) {
        Page<HarvestBatchEntity> result = harvestBatchMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<HarvestBatchEntity>()
                        .like(keyword != null && !keyword.isBlank(), HarvestBatchEntity::getBatchNo, keyword)
                        .eq(status != null, HarvestBatchEntity::getStatus, status)
                        .orderByDesc(HarvestBatchEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public HarvestBatchEntity detail(String id) {
        HarvestBatchEntity entity = harvestBatchMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public HarvestBatchEntity create(HarvestBatchEntity entity) {
        if (entity.getBatchId() == null || entity.getBatchId().isBlank()) {
            entity.setBatchId(ProduceIds.newId(ID_PREFIX));
        }
        harvestBatchMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public HarvestBatchEntity update(String id, HarvestBatchEntity entity) {
        entity.setBatchId(id);
        harvestBatchMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        harvestBatchMapper.deleteById(id);
    }

    /** 由采收记录生成批次：批次号 H + 日期 + 随机，状态置「在库」 */
    @Transactional
    public HarvestBatchEntity generate(HarvestBatchEntity batch) {
        if (batch.getBatchNo() == null || batch.getBatchNo().isBlank()) {
            batch.setBatchNo("H" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
                    + ThreadLocalRandom.current().nextInt(1000, 9999));
        }
        if (batch.getUnit() == null || batch.getUnit().isBlank()) {
            batch.setUnit("kg");
        }
        if (batch.getGrade() == null || batch.getGrade().isBlank()) {
            batch.setGrade("待检");
        }
        if (batch.getQuantity() == null) {
            batch.setQuantity(BigDecimal.ZERO);
        }
        batch.setStatus(1);
        harvestBatchMapper.insert(batch);
        return batch;
    }

    /** 冻结批次（质检不合格或监管要求） */
    @Transactional
    public HarvestBatchEntity freeze(String batchId) {
        HarvestBatchEntity batch = detail(batchId);
        batch.setStatus(4);
        harvestBatchMapper.updateById(batch);
        return batch;
    }

    /** 归档批次 */
    @Transactional
    public HarvestBatchEntity archive(String batchId) {
        HarvestBatchEntity batch = detail(batchId);
        batch.setStatus(5);
        harvestBatchMapper.updateById(batch);
        return batch;
    }

    /** 挂载检测结论 */
    @Transactional
    public HarvestBatchEntity bindInspection(String batchId, String inspectionId, String grade) {
        HarvestBatchEntity batch = detail(batchId);
        batch.setInspectionId(inspectionId);
        batch.setGrade(grade);
        harvestBatchMapper.updateById(batch);
        return batch;
    }
}
