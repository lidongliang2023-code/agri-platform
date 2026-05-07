package com.agri.iot.mapper;

import com.agri.iot.dto.AlertRulePageDTO;
import com.agri.iot.entity.AlertRule;
import com.agri.iot.vo.AlertRuleVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AlertRuleMapper extends BaseMapper<AlertRule> {

    List<AlertRuleVO> selectPageVO(@Param("dto") AlertRulePageDTO dto);

    long selectCount(@Param("dto") AlertRulePageDTO dto);

    AlertRuleVO selectVOById(@Param("id") Long id);

    AlertRule selectByRuleCode(@Param("ruleCode") String ruleCode);

    List<AlertRuleVO> selectEnabledRules();
}
