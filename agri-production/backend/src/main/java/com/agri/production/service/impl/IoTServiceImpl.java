package com.agri.production.service.impl;

import com.agri.production.entity.IoTDevice;
import com.agri.production.entity.SensorData;
import com.agri.production.common.entity.PageResult;
import com.agri.production.mapper.IoTDeviceMapper;
import com.agri.production.mapper.SensorDataMapper;
import com.agri.production.service.IIoTService;
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

    public IoTServiceImpl(IoTDeviceMapper ioTDeviceMapper, SensorDataMapper sensorDataMapper) {
        this.ioTDeviceMapper = ioTDeviceMapper;
        this.sensorDataMapper = sensorDataMapper;
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
    public PageResult<?> listDevices(String deviceName, String deviceType, String status, Integer pageNum, Integer pageSize, String tenantId) {
        Page<IoTDevice> page = new Page<>(pageNum, pageSize);
        IPage<IoTDevice> result = ioTDeviceMapper.pageQuery(page, deviceName, deviceType, status, tenantId);
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
        sensorDataMapper.insert(data);
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