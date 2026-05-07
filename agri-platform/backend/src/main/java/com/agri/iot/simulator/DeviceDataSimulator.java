package com.agri.iot.simulator;

import com.agri.iot.entity.Device;
import com.agri.iot.entity.DeviceData;
import com.agri.iot.mapper.DeviceMapper;
import com.agri.iot.service.IDeviceDataService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Random;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeviceDataSimulator {

    private final DeviceMapper deviceMapper;
    private final IDeviceDataService deviceDataService;
    private final Random random = new Random();

    @Scheduled(fixedRate = 10000)
    public void simulateDataReport() {
        List<Device> onlineDevices = deviceMapper.selectOnlineDevices();

        for (Device device : onlineDevices) {
            DeviceData data = new DeviceData();
            data.setDeviceId(device.getId());
            data.setDeviceCode(device.getDeviceCode());
            data.setPlotId(device.getPlotId());

            generateSensorData(data, device.getDeviceTypeId());

            try {
                deviceDataService.save(data);
            } catch (Exception e) {
                log.error("模拟数据保存失败: {}", e.getMessage());
            }
        }
    }

    private void generateSensorData(DeviceData data, Long deviceTypeId) {
        switch (deviceTypeId.intValue()) {
            case 1 -> {
                data.setTemperature(randomValue(15, 35));
                data.setDeviceStatus("normal");
            }
            case 2 -> {
                data.setHumidity(randomValue(40, 90));
                data.setDeviceStatus("normal");
            }
            case 3 -> {
                data.setSoilMoisture(randomValue(30, 80));
                data.setSoilTemp(randomValue(10, 30));
                data.setDeviceStatus("normal");
            }
            case 4 -> {
                data.setPh(randomValue(5.5, 7.5));
                data.setDeviceStatus("normal");
            }
            case 5 -> {
                data.setLightIntensity(randomValue(0, 100000));
                data.setDeviceStatus("normal");
            }
            case 6 -> {
                data.setCo2(randomValue(400, 2000));
                data.setDeviceStatus("normal");
            }
            case 7, 8, 9 -> {
                data.setTemperature(randomValue(15, 35));
                data.setHumidity(randomValue(40, 90));
                data.setDeviceStatus("running");
            }
            default -> {
                data.setTemperature(randomValue(15, 35));
                data.setHumidity(randomValue(40, 90));
                data.setSoilMoisture(randomValue(30, 80));
                data.setDeviceStatus("normal");
            }
        }
    }

    private BigDecimal randomValue(double min, double max) {
        double value = min + (max - min) * random.nextDouble();
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }
}
