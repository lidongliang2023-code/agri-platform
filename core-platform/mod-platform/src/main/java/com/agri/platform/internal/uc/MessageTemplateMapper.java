package com.agri.platform.internal.uc;

import com.baomidou.mybatisplus.annotation.InterceptorIgnore;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 消息模板 Mapper。
 *
 * <p>用户中心是平台级数据，不按 market_id 隔离。用注解旁路而不是改全局 agri.market.ignore-tables，避免把「哪些表全局」这个事实分散到两处（默认值在 Java、覆盖在 yml）。</p>
 */
@Mapper
@InterceptorIgnore(tenantLine = "true")
public interface MessageTemplateMapper extends BaseMapper<MessageTemplateEntity> {
}
