package com.agri.iot.mapper;

import com.agri.iot.dto.DeviceTypePageDTO;
import com.agri.iot.entity.DeviceType;
import com.agri.iot.vo.DeviceTypeVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DeviceTypeMapper extends BaseMapper<DeviceType> {

    List<DeviceTypeVO> selectPageVO(@Param("dto") DeviceTypePageDTO dto);

    long selectCount(@Param("dto") DeviceTypePageDTO dto);

    DeviceTypeVO selectVOById(@Param("id") Long id);

    DeviceType selectByTypeCode(@Param("typeCode") String typeCode);

    List<DeviceTypeVO> selectAllVO();
}