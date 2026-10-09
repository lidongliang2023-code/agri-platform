package com.agri.produce.internal.quality;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 质量检测（自检/送检/抽检） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class InspectionService {

    private static final String ID_PREFIX = "INSP";

    private final InspectionMapper inspectionMapper;

    /**
     * 分页查询。
     *
     * @param keyword inspectionNo 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<InspectionEntity> page(long page, long size, String keyword, String status) {
        Page<InspectionEntity> result = inspectionMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<InspectionEntity>()
                        .like(keyword != null && !keyword.isBlank(), InspectionEntity::getInspectionNo, keyword)
                        .eq(status != null && !status.isBlank(), InspectionEntity::getStatus, status)
                        .orderByDesc(InspectionEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public InspectionEntity detail(String id) {
        InspectionEntity entity = inspectionMapper.selectById(id);
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
    public InspectionEntity create(InspectionEntity entity) {
        if (entity.getInspectionId() == null || entity.getInspectionId().isBlank()) {
            entity.setInspectionId(ProduceIds.newId(ID_PREFIX));
        }
        inspectionMapper.insert(entity);
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
    public InspectionEntity update(String id, InspectionEntity entity) {
        entity.setInspectionId(id);
        inspectionMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        inspectionMapper.deleteById(id);
    }

    /** 提交检测结论：DONE + PASS/FAIL */
    @Transactional
    public InspectionEntity submitResult(String inspectionId, String result, String reportUrl) {
        InspectionEntity inspection = detail(inspectionId);
        inspection.setResult(result);
        inspection.setReportUrl(reportUrl);
        inspection.setStatus("DONE");
        inspectionMapper.updateById(inspection);
        return inspection;
    }

    /** 批次检测记录 */
    public List<InspectionEntity> listByBatch(String batchId) {
        return inspectionMapper.selectList(new LambdaQueryWrapper<InspectionEntity>()
                .eq(InspectionEntity::getBatchId, batchId)
                .orderByDesc(InspectionEntity::getSampleAt));
    }

    /** 检测项明细（骨架：返回检测单关键结论） */
    public Map<String, Object> items(String inspectionId) {
        InspectionEntity inspection = detail(inspectionId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("inspectionId", inspection.getInspectionId());
        result.put("inspectionNo", inspection.getInspectionNo());
        result.put("inspectionType", inspection.getInspectionType());
        result.put("item", inspection.getInspectionType());
        result.put("result", inspection.getResult());
        result.put("status", inspection.getStatus());
        return result;
    }

    /** 分级统计：按结论聚合 */
    public Map<String, Object> grading() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("PASS", inspectionMapper.selectCount(new LambdaQueryWrapper<InspectionEntity>()
                .eq(InspectionEntity::getResult, "PASS")));
        result.put("FAIL", inspectionMapper.selectCount(new LambdaQueryWrapper<InspectionEntity>()
                .eq(InspectionEntity::getResult, "FAIL")));
        return result;
    }
}
