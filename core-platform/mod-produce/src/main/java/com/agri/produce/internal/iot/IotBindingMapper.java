package com.agri.produce.internal.iot;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * IoT 设备绑定关系 数据访问。
 */
@Mapper
public interface IotBindingMapper extends BaseMapper<IotBindingEntity> {
}
