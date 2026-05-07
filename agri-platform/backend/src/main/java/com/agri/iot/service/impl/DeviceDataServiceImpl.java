package com.agri.iot.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.security.SecurityUtils;
import com.agri.iot.entity.DeviceData;
import com.agri.iot.mapper.DeviceDataMapper;
import com.agri.iot.service.IAlertRecordService;
import com.agri.iot.service.IDeviceDataService;
import com.agri.iot.vo.DeviceDataVO;
import com.agri.iot.vo.RealtimeDataVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DeviceDataServiceImpl implements IDeviceDataService {

    private final DeviceDataMapper deviceDataMapper;
    private final IAlertRecordService alertRecordService;

    @Override
    public PageResult<DeviceDataVO> getHistory(Long deviceId, LocalDateTime startTime, LocalDateTime endTime, Integer pageNum, Integer pageSize) {
        Integer offset = (pageNum - 1) * pageSize;
        List<DeviceDataVO> list = deviceDataMapper.selectHistoryData(deviceId, startTime, endTime, offset, pageSize);
        long count = deviceDataMapper.selectHistoryCount(deviceId, startTime, endTime);
        return new PageResult<>(list, count, (long) pageNum, (long) pageSize);
    }

    @Override
    public RealtimeDataVO getRealtime(Long deviceId) {
        return deviceDataMapper.selectRealtimeData(deviceId);
    }

    @Override
    public List<RealtimeDataVO> getPlotRealtime(Long plotId) {
        return deviceDataMapper.selectPlotRealtimeData(plotId);
    }

    @Override
    @Transactional
    public void save(DeviceData data) {
        data.setTenantId(SecurityUtils.getTenantId());
        data.setCreateBy(SecurityUtils.getUsername());
        data.setReportTime(LocalDateTime.now());
        deviceDataMapper.insert(data);

        alertRecordService.checkAndCreateAlert(data.getDeviceId(), data);
    }
}
