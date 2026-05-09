package com.agri.iot.service;

import com.agri.common.entity.PageResult;
import com.agri.iot.dto.DeviceTypePageDTO;
import com.agri.iot.dto.DeviceTypeSaveDTO;
import com.agri.iot.dto.DeviceTypeUpdateDTO;
import com.agri.iot.vo.DeviceTypeVO;

import java.util.List;

public interface IDeviceTypeService {

    PageResult<DeviceTypeVO> page(DeviceTypePageDTO dto);

    DeviceTypeVO getById(Long id);

    void save(DeviceTypeSaveDTO dto);

    void update(Long id, DeviceTypeUpdateDTO dto);

    void delete(Long id);

    List<DeviceTypeVO> listAll();
}