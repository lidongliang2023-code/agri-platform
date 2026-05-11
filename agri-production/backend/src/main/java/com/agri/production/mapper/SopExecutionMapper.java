package com.agri.production.mapper;

import com.agri.production.entity.SopExecution;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SopExecutionMapper extends BaseMapper<SopExecution> {

    IPage<SopExecution> pageQuery(Page<SopExecution> page, @Param("templateId") Long templateId, @Param("taskId") Long taskId, @Param("status") String status, @Param("tenantId") String tenantId);
}