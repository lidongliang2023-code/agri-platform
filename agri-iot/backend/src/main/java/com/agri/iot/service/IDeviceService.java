package com.agri.iot.service;

import com.agri.common.entity.PageResult;
import com.agri.iot.dto.DevicePageDTO;
import com.agri.iot.dto.DeviceSaveDTO;
import com.agri.iot.dto.DeviceUpdateDTO;
import com.agri.iot.vo.DeviceVO;

public interface IDeviceService {

    PageResult<DeviceVO> page(DevicePageDTO dto);

    DeviceVO getById(Long id);

    void save(DeviceSaveDTO dto);

    void update(Long id, DeviceUpdateDTO dto);

    void delete(Long id);
}