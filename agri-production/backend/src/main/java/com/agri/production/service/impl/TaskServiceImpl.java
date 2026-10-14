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
        task.setAcceptStatus(0); // 待验收（原先写 approval_status，那一列在表里并不存在）
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
        task.setAcceptStatus(0); // 待验收（原先写 approval_status，那一列在表里并不存在）
        updateById(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    @Override
    @Transactional
    public TaskVO acceptTask(Long id, Integer acceptStatus, String remark, String acceptorName, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new RuntimeException("任务不存在");
        }
        if (acceptStatus == null || (acceptStatus != 1 && acceptStatus != 2)) {
            throw new RuntimeException("验收结论只能是 1（通过）或 2（驳回）");
        }
        // 通过：任务完成（完成时间就是实际结束时间，出参 completedAt 由它派生）
        // 驳回：退回执行（status 用词表里的 doing，与前端 isTaskExecuting 兼容），驳回次数 +1
        if (acceptStatus == 1) {
            task.setStatus("completed");
            if (task.getActualEndTime() == null) {
                task.setActualEndTime(java.time.LocalDateTime.now());
            }
        } else {
            task.setStatus("doing");
            task.setRejectCount((task.getRejectCount() == null ? 0 : task.getRejectCount()) + 1);
        }
        task.setAcceptStatus(acceptStatus);
        task.setAcceptRemark(remark);
        task.setAcceptorName(acceptorName);
        task.setAcceptedAt(java.time.LocalDateTime.now());
        updateById(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    @Override
    public java.util.Map<String, Object> getAcceptance(Long id, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new RuntimeException("任务不存在");
        }
        java.util.Map<String, Object> view = new java.util.LinkedHashMap<>();
        // 这个模块没有独立的"验收表"：验收结论就存在任务行上，这里按前端 TaskAcceptance 的字段拼
        view.put("acceptanceId", null);
        view.put("taskId", task.getId());
        view.put("acceptStatus", task.getAcceptStatus() == null ? 0 : task.getAcceptStatus());
        view.put("acceptorId", task.getAcceptorId());
        view.put("acceptorName", task.getAcceptorName());
        view.put("remark", task.getAcceptRemark());
        view.put("attachmentUrls", java.util.List.of());
        view.put("acceptedAt", task.getAcceptedAt());
        return view;
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
