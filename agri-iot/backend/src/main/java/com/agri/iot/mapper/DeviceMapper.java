package com.agri.iot.mapper;

import com.agri.iot.dto.DevicePageDTO;
import com.agri.iot.entity.Device;
import com.agri.iot.vo.DeviceVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DeviceMapper extends BaseMapper<Device> {

    List<DeviceVO> selectDevicePage(@Param("dto") DevicePageDTO dto);

    long selectDeviceCount(@Param("dto") DevicePageDTO dto);

    DeviceVO selectDeviceById(@Param("id") Long id);

    Device selectByDeviceCode(@Param("deviceCode") String deviceCode);

    List<Device> selectOnlineDevices();
}