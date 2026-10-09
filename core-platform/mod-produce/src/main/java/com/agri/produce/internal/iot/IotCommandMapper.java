package com.agri.produce.internal.iot;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * IoT 设备指令下发与回执 数据访问。
 */
@Mapper
public interface IotCommandMapper extends BaseMapper<IotCommandEntity> {
}
