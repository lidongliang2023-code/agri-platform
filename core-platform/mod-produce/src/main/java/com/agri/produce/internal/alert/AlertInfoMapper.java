package com.agri.produce.internal.alert;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 告警记录（规则触发后的处置闭环） 数据访问。
 */
@Mapper
public interface AlertInfoMapper extends BaseMapper<AlertInfoEntity> {
}
