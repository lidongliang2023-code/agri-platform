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
 * 农事任务（派发/执行/验收闭环） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class TaskInfoService {

    private static final String ID_PREFIX = "TASK";

    private final TaskInfoMapper taskInfoMapper;

    /**
     * 分页查询。
     *
     * @param keyword taskName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<TaskInfoEntity> page(long page, long size, String keyword, String status) {
        Page<TaskInfoEntity> result = taskInfoMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<TaskInfoEntity>()
                        .like(keyword != null && !keyword.isBlank(), TaskInfoEntity::getTaskName, keyword)
                        .eq(status != null && !status.isBlank(), TaskInfoEntity::getStatus, status)
                        .orderByDesc(TaskInfoEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public TaskInfoEntity detail(String id) {
        TaskInfoEntity entity = taskInfoMapper.selectById(id);
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
    public TaskInfoEntity create(TaskInfoEntity entity) {
        if (entity.getTaskId() == null || entity.getTaskId().isBlank()) {
            entity.setTaskId(ProduceIds.newId(ID_PREFIX));
        }
        taskInfoMapper.insert(entity);
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
    public TaskInfoEntity update(String id, TaskInfoEntity entity) {
        entity.setTaskId(id);
        taskInfoMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        taskInfoMapper.deleteById(id);
    }

    /**
     * 派发任务：指定执行人并置为 assigned。
     *
     * <p>{@code assigned} 新旧词表同串，无需切换。
     */
    @Transactional
    public TaskInfoEntity assign(String taskId, String assigneeId) {
        TaskInfoEntity task = detail(taskId);
        task.setAssigneeId(assigneeId);
        task.setStatus(TaskStatus.ASSIGNED);
        taskInfoMapper.updateById(task);
        return task;
    }

    /**
     * 开始执行。
     *
     * <p><b>写入口径暂不切换</b>：仍写旧词表 {@link TaskStatus#DOING_LEGACY}。
     * 原因：库内现存数据是旧值，若此刻改成写 {@link TaskStatus#DOING_PRD}，
     * 新旧值会在库里并存，而前端（下一轮才做兼容）此刻只认旧值，会立刻归零。
     * 正确顺序是「代码先全兼容 → 数据一次性切换」，
     * 因此本处留到 V18 迁移那一轮再换成 {@link TaskStatus#DOING_PRD}，
     * 查询侧（{@link TaskStatus#doingValues()}）已经提前兼容，届时无需再改。
     */
    @Transactional
    public TaskInfoEntity start(String taskId) {
        TaskInfoEntity task = detail(taskId);
        task.setStatus(TaskStatus.DOING_LEGACY);
        taskInfoMapper.updateById(task);
        return task;
    }

    /**
     * 验收：通过 → done；驳回 → rejected 且驳回次数 +1。
     *
     * <p>写入口径同 {@link #start(String)}：暂留旧词表 {@link TaskStatus#DONE_LEGACY}，
     * V18 迁移时切 {@link TaskStatus#DONE_PRD}。
     */
    @Transactional
    public TaskInfoEntity accept(String taskId, boolean pass, String opinion) {
        TaskInfoEntity task = detail(taskId);
        if (pass) {
            task.setStatus(TaskStatus.DONE_LEGACY);
            task.setAcceptStatus(1);
            task.setCompletedAt(LocalDateTime.now());
        } else {
            task.setStatus(TaskStatus.REJECTED);
            task.setAcceptStatus(2);
            task.setRejectCount(task.getRejectCount() == null ? 1 : task.getRejectCount() + 1);
        }
        taskInfoMapper.updateById(task);
        return task;
    }

    /**
     * 我的待办：按执行人过滤（已派工 / 执行中）。
     *
     * <p>状态范围取两套写法（{@link TaskStatus#todoValues()}），
     * 迁移前后都能命中，不会静默归零。
     */
    public List<TaskInfoEntity> listByAssignee(String assigneeId) {
        return taskInfoMapper.selectList(new LambdaQueryWrapper<TaskInfoEntity>()
                .eq(TaskInfoEntity::getAssigneeId, assigneeId)
                .in(TaskInfoEntity::getStatus, TaskStatus.todoValues())
                .orderByAsc(TaskInfoEntity::getPlanEndDate));
    }

    /**
     * 提交验收：置为已完成且待验收。
     *
     * <p>写入口径同 {@link #start(String)}：暂留旧词表 {@link TaskStatus#DONE_LEGACY}，
     * V18 迁移时切 {@link TaskStatus#DONE_PRD}。
     */
    @Transactional
    public TaskInfoEntity submit(String taskId) {
        TaskInfoEntity task = detail(taskId);
        task.setStatus(TaskStatus.DONE_LEGACY);
        task.setAcceptStatus(0);
        task.setCompletedAt(LocalDateTime.now());
        taskInfoMapper.updateById(task);
        return task;
    }
}
