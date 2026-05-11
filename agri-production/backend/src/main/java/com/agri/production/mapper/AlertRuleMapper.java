package com.agri.production.mapper;

import com.agri.production.dto.AlertRuleSaveDTO;
import com.agri.production.entity.AlertRule;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface AlertRuleMapper extends BaseMapper<AlertRule> {

    IPage<AlertRule> pageQuery(Page<AlertRule> page, @Param("dto") AlertRuleSaveDTO dto, @Param("tenantId") String tenantId);

    AlertRule selectByCode(@Param("ruleCode") String ruleCode, @Param("tenantId") String tenantId);
}