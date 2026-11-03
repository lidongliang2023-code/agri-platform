package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.PermissionRule;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** 权限巡检规则（读多写少，运营端只读；改阈值走库里/后续的配置页）。 */
@Mapper
public interface PermissionRuleMapper extends BaseMapper<PermissionRule> {
}
