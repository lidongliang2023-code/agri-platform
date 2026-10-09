package com.agri.produce.internal.iot;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * IoT 设备维修记录 数据访问。
 */
@Mapper
public interface IotMaintenanceMapper extends BaseMapper<IotMaintenanceEntity> {
}
