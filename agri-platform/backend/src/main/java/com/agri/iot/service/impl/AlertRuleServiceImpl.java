package com.agri.iot.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.iot.dto.AlertRulePageDTO;
import com.agri.iot.dto.AlertRuleSaveDTO;
import com.agri.iot.dto.AlertRuleUpdateDTO;
import com.agri.iot.entity.AlertRule;
import com.agri.iot.mapper.AlertRuleMapper;
import com.agri.iot.service.IAlertRuleService;
import com.agri.iot.vo.AlertRuleVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AlertRuleServiceImpl implements IAlertRuleService {

    private final AlertRuleMapper alertRuleMapper;

    @Override
    public PageResult<AlertRuleVO> page(AlertRulePageDTO dto) {
        dto.setPageNum((dto.getPageNum() - 1) * dto.getPageSize());
        List<AlertRuleVO> list = alertRuleMapper.selectPageVO(dto);
        long count = alertRuleMapper.selectCount(dto);
        return new PageResult<>(list, count, (long) (dto.getPageNum() / dto.getPageSize() + 1), (long) dto.getPageSize());
    }

    @Override
    public AlertRuleVO getById(Long id) {
        return alertRuleMapper.selectVOById(id);
    }

    @Override
    @Transactional
    public void save(AlertRuleSaveDTO dto) {
        AlertRule existing = alertRuleMapper.selectByRuleCode(dto.getRuleCode());
        if (existing != null) {
            throw new BusinessException("规则编码已存在");
        }

        AlertRule alertRule = BeanCopyUtils.copy(dto, AlertRule.class);
        alertRule.setTenantId(SecurityUtils.getTenantId());
        alertRule.setCreateBy(SecurityUtils.getUsername());
        alertRule.setDelFlag(0);
        alertRuleMapper.insert(alertRule);
    }

    @Override
    @Transactional
    public void update(Long id, AlertRuleUpdateDTO dto) {
        AlertRule alertRule = alertRuleMapper.selectById(id);
        if (alertRule == null || alertRule.getDelFlag() == 1) {
            throw new BusinessException("预警规则不存在");
        }

        if (dto.getRuleCode() != null && !dto.getRuleCode().equals(alertRule.getRuleCode())) {
            AlertRule existing = alertRuleMapper.selectByRuleCode(dto.getRuleCode());
            if (existing != null && !existing.getId().equals(id)) {
                throw new BusinessException("规则编码已存在");
            }
        }

        BeanCopyUtils.copyProperties(dto, alertRule);
        alertRule.setUpdateBy(SecurityUtils.getUsername());
        alertRuleMapper.updateById(alertRule);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        AlertRule alertRule = alertRuleMapper.selectById(id);
        if (alertRule == null || alertRule.getDelFlag() == 1) {
            throw new BusinessException("预警规则不存在");
        }

        alertRule.setDelFlag(1);
        alertRule.setUpdateBy(SecurityUtils.getUsername());
        alertRuleMapper.updateById(alertRule);
    }

    @Override
    @Transactional
    public void changeStatus(Long id, Integer status) {
        AlertRule alertRule = alertRuleMapper.selectById(id);
        if (alertRule == null || alertRule.getDelFlag() == 1) {
            throw new BusinessException("预警规则不存在");
        }

        alertRule.setEnableStatus(status);
        alertRule.setUpdateBy(SecurityUtils.getUsername());
        alertRuleMapper.updateById(alertRule);
    }

    @Override
    public List<AlertRuleVO> listEnabled() {
        return alertRuleMapper.selectEnabledRules();
    }
}
