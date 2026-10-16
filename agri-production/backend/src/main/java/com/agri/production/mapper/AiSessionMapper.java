package com.agri.production.mapper;

import com.agri.production.entity.AiSession;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** AI 问答会话 mapper。 */
@Mapper
public interface AiSessionMapper extends BaseMapper<AiSession> {
}
