package com.agri.production.mapper;

import com.agri.production.dto.TaskPageDTO;
import com.agri.production.entity.Task;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface TaskMapper extends BaseMapper<Task> {

    IPage<Task> pageQuery(Page<Task> page, @Param("dto") TaskPageDTO dto, @Param("tenantId") String tenantId);

    List<Task> selectByFarmId(@Param("farmId") Long farmId, @Param("tenantId") String tenantId);

    List<Task> selectByExecutorId(@Param("executorId") Long executorId, @Param("tenantId") String tenantId);

    Task selectByCode(@Param("taskCode") String taskCode, @Param("tenantId") String tenantId);
}