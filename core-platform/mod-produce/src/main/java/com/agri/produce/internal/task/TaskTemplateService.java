package com.agri.produce.internal.task;

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
 * 农事任务模板（按作物/阶段预置） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class TaskTemplateService {

    private static final String ID_PREFIX = "TPL";

    private final TaskTemplateMapper taskTemplateMapper;

    /**
     * 分页查询。
     *
     * @param keyword templateName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<TaskTemplateEntity> page(long page, long size, String keyword, Integer status) {
        Page<TaskTemplateEntity> result = taskTemplateMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<TaskTemplateEntity>()
                        .like(keyword != null && !keyword.isBlank(), TaskTemplateEntity::getTemplateName, keyword)
                        .eq(status != null, TaskTemplateEntity::getStatus, status)
                        .orderByDesc(TaskTemplateEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public TaskTemplateEntity detail(String id) {
        TaskTemplateEntity entity = taskTemplateMapper.selectById(id);
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
    public TaskTemplateEntity create(TaskTemplateEntity entity) {
        if (entity.getTemplateId() == null || entity.getTemplateId().isBlank()) {
            entity.setTemplateId(ProduceIds.newId(ID_PREFIX));
        }
        taskTemplateMapper.insert(entity);
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
    public TaskTemplateEntity update(String id, TaskTemplateEntity entity) {
        entity.setTemplateId(id);
        taskTemplateMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        taskTemplateMapper.deleteById(id);
    }

    /** 按作物取模板（生成计划任务时使用） */
    public List<TaskTemplateEntity> listByCrop(String cropId) {
        return taskTemplateMapper.selectList(new LambdaQueryWrapper<TaskTemplateEntity>()
                .eq(cropId != null && !cropId.isBlank(), TaskTemplateEntity::getCropId, cropId)
                .eq(TaskTemplateEntity::getStatus, 1)
                .orderByAsc(TaskTemplateEntity::getStageSeq));
    }
}
