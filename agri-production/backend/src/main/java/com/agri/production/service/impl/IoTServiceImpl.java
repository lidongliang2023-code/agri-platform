package com.agri.production.service.impl;

import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.AlertRule;
import com.agri.production.entity.IoTDevice;
import com.agri.production.entity.SensorData;
import com.agri.production.common.entity.PageResult;
import com.agri.production.mapper.AlertRuleMapper;
import com.agri.production.mapper.IoTDeviceMapper;
import com.agri.production.mapper.SensorDataMapper;
import com.agri.production.service.IAlertService;
import com.agri.production.service.IIoTService;
import com.agri.production.service.IProductionNotificationService;
import com.agri.production.service.TenantContextService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class IoTServiceImpl implements IIoTService {

    private final IoTDeviceMapper ioTDeviceMapper;
    private final SensorDataMapper sensorDataMapper;
    private final AlertRuleMapper alertRuleMapper;
    private final IAlertService alertService;
    private final IProductionNotificationService notificationService;

    public IoTServiceImpl(IoTDeviceMapper ioTDeviceMapper, SensorDataMapper sensorDataMapper,
                          AlertRuleMapper alertRuleMapper, IAlertService alertService,
                          IProductionNotificationService notificationService) {
        this.ioTDeviceMapper = ioTDeviceMapper;
        this.sensorDataMapper = sensorDataMapper;
        this.alertRuleMapper = alertRuleMapper;
        this.alertService = alertService;
        this.notificationService = notificationService;
    }

    @Override
    @Transactional
    public IoTDevice saveDevice(IoTDevice device, String tenantId) {
        device.setTenantId(tenantId);
        if (device.getId() == null) {
            device.setDeviceCode("DEV" + System.currentTimeMillis());
            device.setStatus("offline");
            device.setCreateTime(LocalDateTime.now());
            ioTDeviceMapper.insert(device);
        } else {
            device.setUpdateTime(LocalDateTime.now());
            ioTDeviceMapper.updateById(device);
        }
        return device;
    }

    @Override
    @Transactional
    public void deleteDevice(Long id) {
        ioTDeviceMapper.deleteById(id);
    }

    @Override
    public IoTDevice getDeviceById(Long id) {
        return ioTDeviceMapper.selectById(id);
    }

    @Override
    public PageResult<?> listDevices(String deviceName, String deviceType, String status, Integer pageNum,
                                     Integer pageSize, String tenantId, Long farmId) {
        Page<IoTDevice> page = new Page<>(pageNum, pageSize);
        IPage<IoTDevice> result = ioTDeviceMapper.pageQuery(page, deviceName, deviceType, status, tenantId, farmId);
        return PageResult.of(result.getRecords(), result.getTotal(), pageNum, pageSize);
    }

    @Override
    @Transactional
    public void enableDevice(Long id, boolean enable) {
        IoTDevice device = ioTDeviceMapper.selectById(id);
        if (device != null) {
            device.setIsEnabled(enable ? 1 : 0);
            ioTDeviceMapper.updateById(device);
        }
    }

    @Override
    @Transactional
    public void updateDeviceStatus(Long id, String status) {
        IoTDevice device = ioTDeviceMapper.selectById(id);
        if (device != null) {
            device.setStatus(status);
            device.setLastOnlineTime("online".equals(status) ? LocalDateTime.now() : device.getLastOnlineTime());
            ioTDeviceMapper.updateById(device);
        }
    }

    @Override
    @Transactional
    public void saveSensorData(SensorData data) {
        data.setDataTime(LocalDateTime.now());
        if (data.getTenantId() == null || data.getTenantId().isBlank()) {
            data.setTenantId(TenantContextService.currentTenantId());
        }
        sensorDataMapper.insert(data);
        evaluateSensorRules(data);
    }

    /** 按已配置阈值的环境规则生成告警；没有阈值或没有命中时不编造告警。 */
    private void evaluateSensorRules(SensorData data) {
        if (data.getValue() == null || data.getSensorType() == null || data.getTenantId() == null) {
            return;
        }
        List<AlertRule> rules = alertRuleMapper.selectList(new LambdaQueryWrapper<AlertRule>()
                .eq(AlertRule::getTenantId, data.getTenantId())
                .eq(AlertRule::getIsEnabled, 1)
                .and(q -> q.eq(AlertRule::getAlertType, data.getSensorType())
                        .or().eq(AlertRule::getSourceType, "SENSOR")));
        IoTDevice device = data.getDeviceId() == null ? null : ioTDeviceMapper.selectById(data.getDeviceId());
        for (AlertRule rule : rules) {
            if (!matchesSensorType(rule, data.getSensorType())) {
                continue;
            }
            boolean below = rule.getThresholdMin() != null && data.getValue().compareTo(rule.getThresholdMin()) < 0;
            boolean above = rule.getThresholdMax() != null && data.getValue().compareTo(rule.getThresholdMax()) > 0;
            if (!below && !above) {
                continue;
            }
            AlertRecord alert = new AlertRecord();
            alert.setRuleId(rule.getId());
            alert.setRuleCode(rule.getRuleCode());
            alert.setAlertType(rule.getAlertType());
            alert.setLevel(rule.getLevel());
            alert.setSourceType("sensor");
            alert.setSourceId(data.getDeviceId());
            alert.setSourceName(data.getDeviceCode());
            alert.setFarmId(device == null ? data.getFarmId() : device.getFarmId());
            alert.setPlotId(device == null ? data.getPlotId() : device.getPlotId());
            alert.setTitle(rule.getRuleName());
            alert.setContent(String.format("设备 %s 的 %s 实测 %s%s，越过阈值 %s。",
                    data.getDeviceCode() == null ? "未知设备" : data.getDeviceCode(),
                    data.getSensorName() == null ? data.getSensorType() : data.getSensorName(),
                    data.getValue().stripTrailingZeros().toPlainString(),
                    data.getUnit() == null ? "" : data.getUnit(),
                    below ? "下限 " + rule.getThresholdMin().stripTrailingZeros().toPlainString()
                            : "上限 " + rule.getThresholdMax().stripTrailingZeros().toPlainString()));
            alert.setValue(data.getValue());
            alert.setThresholdMin(rule.getThresholdMin());
            alert.setThresholdMax(rule.getThresholdMax());
            alert.setUnit(data.getUnit());
            alert.setTenantId(data.getTenantId());
            AlertRecord saved = alertService.triggerAlert(alert);
            notificationService.notify(data.getTenantId(),
                    saved.getFarmId() == null ? null : String.valueOf(saved.getFarmId()),
                    rule.getNotifyUsers(), "ALERT", saved.getTitle(), saved.getContent(),
                    saved.getAlertCode(), "/production/alerts");
        }
    }

    private static boolean matchesSensorType(AlertRule rule, String sensorType) {
        if (rule.getAlertType() != null && rule.getAlertType().equalsIgnoreCase(sensorType)) {
            return true;
        }
        String type = sensorType.toLowerCase();
        String name = rule.getRuleName() == null ? "" : rule.getRuleName().toLowerCase();
        return ("soil_moisture".equals(type) && (name.contains("土壤湿度") || name.contains("湿度")))
                || ("temperature".equals(type) && (name.contains("温度") || name.contains("temperature")))
                || ("humidity".equals(type) && (name.contains("湿度") || name.contains("humidity")));
    }

    @Override
    public List<SensorData> getSensorHistory(Long deviceId, LocalDateTime startTime, LocalDateTime endTime) {
        return sensorDataMapper.selectByDeviceId(deviceId, startTime, endTime);
    }

    @Override
    public List<Map<String, Object>> getLatestData(List<Long> deviceIds) {
        return sensorDataMapper.getLatestByDevice(deviceIds);
    }

    @Override
    public List<Map<String, Object>> getHourlyAverage(Long deviceId, LocalDateTime startTime, LocalDateTime endTime) {
        return sensorDataMapper.getHourlyAverage(deviceId, startTime, endTime);
    }

    @Override
    public Map<String, Object> getDeviceStatistics(Long deviceId, LocalDateTime startTime, LocalDateTime endTime) {
        return sensorDataMapper.getStatistics(deviceId, startTime, endTime);
    }

    @Override
    public Map<String, Object> getIoTStatistics(String tenantId) {
        Map<String, Object> result = new HashMap<>();
        result.put("total", ioTDeviceMapper.selectCount(null));
        result.put("online", ioTDeviceMapper.countByStatus("online", tenantId));
        result.put("offline", ioTDeviceMapper.countByStatus("offline", tenantId));
        result.put("error", ioTDeviceMapper.countByStatus("error", tenantId));
        return result;
    }
}
