package com.agri.production.mapper;

import com.agri.production.entity.SopTemplate;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SopTemplateMapper extends BaseMapper<SopTemplate> {

    IPage<SopTemplate> pageQuery(Page<SopTemplate> page, @Param("templateName") String templateName, @Param("category") String category, @Param("taskType") String taskType, @Param("tenantId") String tenantId);

    List<SopTemplate> selectByTaskType(@Param("taskType") String taskType, @Param("tenantId") String tenantId);
}