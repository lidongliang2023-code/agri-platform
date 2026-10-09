package com.agri.produce.internal.iot;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * IoT 设备档案（采集与长连接在 satellite-iot） 数据访问。
 */
@Mapper
public interface IotDeviceMapper extends BaseMapper<IotDeviceEntity> {
}
