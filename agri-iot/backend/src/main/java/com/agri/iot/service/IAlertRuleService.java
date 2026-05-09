package com.agri.iot.service;

import com.agri.common.entity.PageResult;
import com.agri.iot.dto.AlertRulePageDTO;
import com.agri.iot.dto.AlertRuleSaveDTO;
import com.agri.iot.dto.AlertRuleUpdateDTO;
import com.agri.iot.vo.AlertRuleVO;

import java.util.List;

public interface IAlertRuleService {

    PageResult<AlertRuleVO> page(AlertRulePageDTO dto);

    AlertRuleVO getById(Long id);

    void save(AlertRuleSaveDTO dto);

    void update(Long id, AlertRuleUpdateDTO dto);

    void delete(Long id);

    void changeStatus(Long id, Integer status);

    List<AlertRuleVO> listEnabled();
}