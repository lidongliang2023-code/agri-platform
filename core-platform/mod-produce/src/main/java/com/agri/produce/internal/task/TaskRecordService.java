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
 * 农事任务执行记录（支持离线回传） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class TaskRecordService {

    private static final String ID_PREFIX = "TRCD";

    private final TaskRecordMapper taskRecordMapper;

    /**
     * 分页查询。
     *
     * @return 分页结果
     */
    public PageResult<TaskRecordEntity> page(long page, long size) {
        Page<TaskRecordEntity> result = taskRecordMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<TaskRecordEntity>()
                        .orderByDesc(TaskRecordEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public TaskRecordEntity detail(String id) {
        TaskRecordEntity entity = taskRecordMapper.selectById(id);
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
    public TaskRecordEntity create(TaskRecordEntity entity) {
        if (entity.getRecordId() == null || entity.getRecordId().isBlank()) {
            entity.setRecordId(ProduceIds.newId(ID_PREFIX));
        }
        taskRecordMapper.insert(entity);
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
    public TaskRecordEntity update(String id, TaskRecordEntity entity) {
        entity.setRecordId(id);
        taskRecordMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        taskRecordMapper.deleteById(id);
    }

    /** 任务执行流水 */
    public List<TaskRecordEntity> listByTask(String taskId) {
        return taskRecordMapper.selectList(new LambdaQueryWrapper<TaskRecordEntity>()
                .eq(TaskRecordEntity::getTaskId, taskId)
                .orderByDesc(TaskRecordEntity::getExecuteTime));
    }
}
