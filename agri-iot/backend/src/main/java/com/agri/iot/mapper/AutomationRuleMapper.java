package com.agri.iot.mapper;

import com.agri.iot.dto.request.AutomationRuleQueryDTO;
import com.agri.iot.entity.AutomationRule;
import com.agri.iot.vo.AutomationRuleVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface AutomationRuleMapper extends BaseMapper<AutomationRule> {

    List<AutomationRuleVO> selectPageVO(@Param("dto") AutomationRuleQueryDTO dto);

    long selectCount(@Param("dto") AutomationRuleQueryDTO dto);

    AutomationRuleVO selectVOById(Long id);

    AutomationRule selectByRuleCode(String ruleCode);

    List<AutomationRuleVO> selectEnabledRules();
}