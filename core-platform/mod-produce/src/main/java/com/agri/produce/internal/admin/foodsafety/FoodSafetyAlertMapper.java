package com.agri.produce.internal.admin.foodsafety;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 食品安全告警 数据访问。
 */
@Mapper
public interface FoodSafetyAlertMapper extends BaseMapper<FoodSafetyAlertEntity> {
}
