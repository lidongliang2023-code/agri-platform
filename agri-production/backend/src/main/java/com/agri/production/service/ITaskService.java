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

    /**
     * 任务验收（前端契约：POST /tasks/{id}/acceptance）。
     *
     * @param acceptStatus 0 待验收 1 通过 2 驳回
     * @param remark       验收意见
     * @param acceptorName 验收人姓名（这个模块还没有从令牌取显示名的能力，先由请求带入）
     */
    TaskVO acceptTask(Long id, Integer acceptStatus, String remark, String acceptorName, String tenantId);

    /** 验收视图（前端 TaskAcceptance 页读的字段）。 */
    java.util.Map<String, Object> getAcceptance(Long id, String tenantId);

    List<TaskVO> listByFarmId(Long farmId, String tenantId);

    List<TaskVO> listByExecutorId(Long executorId, String tenantId);

    TaskVO getByCode(String taskCode, String tenantId);
}
