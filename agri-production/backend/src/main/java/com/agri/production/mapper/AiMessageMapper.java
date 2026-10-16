package com.agri.production.mapper;

import com.agri.production.entity.AiMessage;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** AI 问答消息 mapper。 */
@Mapper
public interface AiMessageMapper extends BaseMapper<AiMessage> {
}
