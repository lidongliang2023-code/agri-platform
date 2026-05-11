package com.agri.production.service;

import com.agri.production.entity.IoTDevice;
import com.agri.production.entity.SensorData;
import com.agri.production.common.entity.PageResult;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public interface IIoTService {

    IoTDevice saveDevice(IoTDevice device, String tenantId);

    void deleteDevice(Long id);

    IoTDevice getDeviceById(Long id);

    PageResult<?> listDevices(String deviceName, String deviceType, String status, Integer pageNum, Integer pageSize, String tenantId);

    void enableDevice(Long id, boolean enable);

    void updateDeviceStatus(Long id, String status);

    void saveSensorData(SensorData data);

    List<SensorData> getSensorHistory(Long deviceId, LocalDateTime startTime, LocalDateTime endTime);

    List<Map<String, Object>> getLatestData(List<Long> deviceIds);

    List<Map<String, Object>> getHourlyAverage(Long deviceId, LocalDateTime startTime, LocalDateTime endTime);

    Map<String, Object> getDeviceStatistics(Long deviceId, LocalDateTime startTime, LocalDateTime endTime);

    Map<String, Object> getIoTStatistics(String tenantId);
}