package com.agri.iot.service;

import com.agri.common.entity.PageResult;
import com.agri.iot.entity.DeviceData;
import com.agri.iot.vo.DeviceDataVO;
import com.agri.iot.vo.RealtimeDataVO;

import java.time.LocalDateTime;
import java.util.List;

public interface IDeviceDataService {

    PageResult<DeviceDataVO> getHistory(Long deviceId, LocalDateTime startTime, LocalDateTime endTime, Integer pageNum, Integer pageSize);

    RealtimeDataVO getRealtime(Long deviceId);

    List<RealtimeDataVO> getPlotRealtime(Long plotId);

    void save(DeviceData data);
}
