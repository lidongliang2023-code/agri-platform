package com.agri.production.service;

import com.agri.production.dto.TaskPageDTO;
import com.agri.production.dto.TaskSaveDTO;
import com.agri.production.entity.Task;
import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.TaskVO;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface ITaskService extends IService<Task> {

    TaskVO save(TaskSaveDTO dto, String tenantId);

    TaskVO update(TaskSaveDTO dto, String tenantId);

    void delete(Long id, String tenantId);

    TaskVO getById(Long id, String tenantId);

    PageResult<TaskVO> pageQuery(TaskPageDTO dto, String tenantId);

    TaskVO startTask(Long id, String tenantId);

    TaskVO completeTask(Long id, String resultDesc, String resultPhotoUrls, String tenantId);

    TaskVO approveTask(Long id, String approvalStatus, String approvalComment, String tenantId);

    List<TaskVO> listByFarmId(Long farmId, String tenantId);

    List<TaskVO> listByExecutorId(Long executorId, String tenantId);

    TaskVO getByCode(String taskCode, String tenantId);
}