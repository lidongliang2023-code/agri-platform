package com.agri.produce.internal.iot;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * IoT 监测读数（时序，卫星服务回传） 数据访问。
 */
@Mapper
public interface IotReadingMapper extends BaseMapper<IotReadingEntity> {
}
