package com.agri.production.service.impl;

import com.agri.production.dto.TaskPageDTO;
import com.agri.production.dto.TaskSaveDTO;
import com.agri.production.entity.Task;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.service.ITaskService;
import com.agri.production.vo.TaskVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TaskServiceImpl extends ServiceImpl<TaskMapper, Task> implements ITaskService {

    @Override
    @Transactional
    public TaskVO save(TaskSaveDTO dto, String tenantId) {
        Task task = BeanCopyUtils.copy(dto, Task.class);
        task.setTenantId(tenantId);
        task.setTaskCode(generateTaskCode(tenantId));
        task.setStatus("pending");
        task.setApprovalStatus("pending");
        save(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    @Override
    @Transactional
    public TaskVO update(TaskSaveDTO dto, String tenantId) {
        Task task = getById(dto.getId());
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new RuntimeException("任务不存在");
        }
        if (!"pending".equals(task.getStatus())) {
            throw new RuntimeException("任务已开始执行，无法修改");
        }
        BeanCopyUtils.copy(dto, task);
        updateById(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    @Override
    @Transactional
    public void delete(Long id, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new RuntimeException("任务不存在");
        }
        if ("executing".equals(task.getStatus())) {
            throw new RuntimeException("任务正在执行中，无法删除");
        }
        removeById(id);
    }

    @Override
    public TaskVO getById(Long id, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new RuntimeException("任务不存在");
        }
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    @Override
    public PageResult<TaskVO> pageQuery(TaskPageDTO dto, String tenantId) {
        Page<Task> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<Task> result = baseMapper.pageQuery(page, dto, tenantId);
        List<TaskVO> voList = BeanCopyUtils.copyList(result.getRecords(), TaskVO.class);
        return PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize());
    }

    @Override
    @Transactional
    public TaskVO startTask(Long id, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new RuntimeException("任务不存在");
        }
        if (!"pending".equals(task.getStatus())) {
            throw new RuntimeException("任务状态不正确");
        }
        task.setStatus("executing");
        task.setActualStartTime(LocalDateTime.now());
        updateById(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    @Override
    @Transactional
    public TaskVO completeTask(Long id, String resultDesc, String resultPhotoUrls, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new RuntimeException("任务不存在");
        }
        if (!"executing".equals(task.getStatus())) {
            throw new RuntimeException("任务状态不正确");
        }
        task.setStatus("completed");
        task.setActualEndTime(LocalDateTime.now());
        task.setResultDesc(resultDesc);
        task.setResultPhotoUrls(resultPhotoUrls);
        task.setApprovalStatus("pending");
        updateById(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    @Override
    @Transactional
    public TaskVO approveTask(Long id, String approvalStatus, String approvalComment, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new RuntimeException("任务不存在");
        }
        if (!"completed".equals(task.getStatus())) {
            throw new RuntimeException("任务未完成，无法审批");
        }
        task.setApprovalStatus(approvalStatus);
        task.setApprovalComment(approvalComment);
        if ("rejected".equals(approvalStatus)) {
            task.setStatus("rejected");
        }
        updateById(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    @Override
    public List<TaskVO> listByFarmId(Long farmId, String tenantId) {
        List<Task> tasks = baseMapper.selectByFarmId(farmId, tenantId);
        return BeanCopyUtils.copyList(tasks, TaskVO.class);
    }

    @Override
    public List<TaskVO> listByExecutorId(Long executorId, String tenantId) {
        List<Task> tasks = baseMapper.selectByExecutorId(executorId, tenantId);
        return BeanCopyUtils.copyList(tasks, TaskVO.class);
    }

    @Override
    public TaskVO getByCode(String taskCode, String tenantId) {
        Task task = baseMapper.selectByCode(taskCode, tenantId);
        if (task == null) {
            throw new RuntimeException("任务不存在");
        }
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    private String generateTaskCode(String tenantId) {
        return "TSK" + System.currentTimeMillis() % 1000000;
    }
}