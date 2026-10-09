package com.agri.produce.internal.setting;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 系统配置项（租户/农场级参数） 数据访问。
 */
@Mapper
public interface SysSettingMapper extends BaseMapper<SysSettingEntity> {
}
