package com.agri.iot.service;

import com.agri.common.entity.PageResult;
import com.agri.iot.dto.AlertHandleDTO;
import com.agri.iot.dto.AlertRecordPageDTO;
import com.agri.iot.entity.DeviceData;
import com.agri.iot.vo.AlertRecordVO;

import java.util.List;

public interface IAlertRecordService {

    PageResult<AlertRecordVO> page(AlertRecordPageDTO dto);

    AlertRecordVO getById(Long id);

    void handle(Long id, AlertHandleDTO dto);

    void batchHandle(List<Long> ids, String result);

    long getUnhandledCount();

    List<AlertRecordVO> getRecentAlerts(Integer limit);

    void checkAndCreateAlert(Long deviceId, DeviceData data);
}