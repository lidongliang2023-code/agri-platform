package com.agri.iot.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.iot.dto.AlertHandleDTO;
import com.agri.iot.dto.AlertRecordPageDTO;
import com.agri.iot.entity.AlertRecord;
import com.agri.iot.entity.Device;
import com.agri.iot.entity.DeviceData;
import com.agri.iot.mapper.AlertRecordMapper;
import com.agri.iot.mapper.DeviceMapper;
import com.agri.iot.service.IAlertRecordService;
import com.agri.iot.service.IAlertRuleService;
import com.agri.iot.vo.AlertRecordVO;
import com.agri.iot.vo.AlertRuleVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AlertRecordServiceImpl implements IAlertRecordService {

    private final AlertRecordMapper alertRecordMapper;
    private final DeviceMapper deviceMapper;
    private final IAlertRuleService alertRuleService;

    @Override
    public PageResult<AlertRecordVO> page(AlertRecordPageDTO dto) {
        dto.setPageNum((dto.getPageNum() - 1) * dto.getPageSize());
        List<AlertRecordVO> list = alertRecordMapper.selectPageVO(dto);
        long count = alertRecordMapper.selectCount(dto);
        return new PageResult<>(list, count, (long) (dto.getPageNum() / dto.getPageSize() + 1), (long) dto.getPageSize());
    }

    @Override
    public AlertRecordVO getById(Long id) {
        return alertRecordMapper.selectVOById(id);
    }

    @Override
    @Transactional
    public void handle(Long id, AlertHandleDTO dto) {
        AlertRecord record = alertRecordMapper.selectById(id);
        if (record == null || record.getDelFlag() == 1) {
            throw new BusinessException("预警记录不存在");
        }

        record.setHandleStatus(dto.getHandleStatus());
        record.setHandleResult(dto.getHandleResult());
        record.setHandleTime(LocalDateTime.now());
        record.setHandleUser(SecurityUtils.getUsername());
        alertRecordMapper.updateById(record);
    }

    @Override
    @Transactional
    public void batchHandle(List<Long> ids, String result) {
        for (Long id : ids) {
            AlertRecord record = alertRecordMapper.selectById(id);
            if (record != null && record.getDelFlag() == 0) {
                record.setHandleStatus(3);
                record.setHandleResult(result);
                record.setHandleTime(LocalDateTime.now());
                record.setHandleUser(SecurityUtils.getUsername());
                alertRecordMapper.updateById(record);
            }
        }
    }

    @Override
    public long getUnhandledCount() {
        return alertRecordMapper.selectUnhandledCount();
    }

    @Override
    public List<AlertRecordVO> getRecentAlerts(Integer limit) {
        return alertRecordMapper.selectRecentAlerts(limit);
    }

    @Override
    @Transactional
    public void checkAndCreateAlert(Long deviceId, DeviceData data) {
        List<AlertRuleVO> rules = alertRuleService.listEnabled();
        if (rules.isEmpty()) {
            return;
        }

        Device device = deviceMapper.selectById(deviceId);
        if (device == null) {
            return;
        }

        for (AlertRuleVO rule : rules) {
            if (matchRule(rule, data)) {
                createAlertRecord(rule, device, data);
            }
        }
    }

    private boolean matchRule(AlertRuleVO rule, DeviceData data) {
        BigDecimal value = getPropertyValue(rule.getPropertyCode(), data);
        if (value == null) {
            return false;
        }

        BigDecimal threshold = new BigDecimal(rule.getThresholdValue());
        String operator = rule.getOperator();

        return switch (operator) {
            case ">" -> value.compareTo(threshold) > 0;
            case "<" -> value.compareTo(threshold) < 0;
            case ">=" -> value.compareTo(threshold) >= 0;
            case "<=" -> value.compareTo(threshold) <= 0;
            case "==" -> value.compareTo(threshold) == 0;
            case "!=" -> value.compareTo(threshold) != 0;
            default -> false;
        };
    }

    private BigDecimal getPropertyValue(String propertyCode, DeviceData data) {
        return switch (propertyCode) {
            case "temperature" -> data.getTemperature();
            case "humidity" -> data.getHumidity();
            case "soil_moisture" -> data.getSoilMoisture();
            case "soil_temp" -> data.getSoilTemp();
            case "ph" -> data.getPh();
            case "light_intensity" -> data.getLightIntensity();
            case "co2" -> data.getCo2();
            default -> null;
        };
    }

    private void createAlertRecord(AlertRuleVO rule, Device device, DeviceData data) {
        AlertRecord record = new AlertRecord();
        record.setAlertNo("ALERT" + System.currentTimeMillis());
        record.setRuleId(rule.getId());
        record.setRuleName(rule.getRuleName());
        record.setDeviceId(device.getId());
        record.setDeviceCode(device.getDeviceCode());
        record.setDeviceName(device.getDeviceName());
        record.setPlotId(device.getPlotId());
        record.setAlertLevel(rule.getAlertLevel());
        record.setPropertyCode(rule.getPropertyCode());
        record.setPropertyName(rule.getPropertyName());
        record.setTriggerValue(getPropertyValue(rule.getPropertyCode(), data)?.toString());
        record.setThresholdValue(rule.getThresholdValue());
        record.setAlertContent(buildAlertContent(rule, device, data));
        record.setAlertTime(LocalDateTime.now());
        record.setHandleStatus(1);
        record.setTenantId(SecurityUtils.getTenantId());
        record.setDelFlag(0);

        alertRecordMapper.insert(record);
    }

    private String buildAlertContent(AlertRuleVO rule, Device device, DeviceData data) {
        BigDecimal value = getPropertyValue(rule.getPropertyCode(), data);
        return String.format("%s [%s] %s %s %s，当前值: %s",
                rule.getRuleName(),
                device.getDeviceName(),
                rule.getPropertyName(),
                rule.getOperator(),
                rule.getThresholdValue(),
                value);
    }
}
