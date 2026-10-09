package com.agri.produce.internal.alert;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 告警规则（阈值/持续时长/通知渠道） 数据访问。
 */
@Mapper
public interface AlertRuleMapper extends BaseMapper<AlertRuleEntity> {
}
