package com.agri.produce.internal.message;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 站内通知（任务/告警/质检/系统） 数据访问。
 */
@Mapper
public interface MessageNotifyMapper extends BaseMapper<MessageNotifyEntity> {
}
