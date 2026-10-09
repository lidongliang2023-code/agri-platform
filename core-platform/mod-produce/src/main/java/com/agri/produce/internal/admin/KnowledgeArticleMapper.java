package com.agri.produce.internal.admin;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 农技知识文章（种植/植保/政策） 数据访问。
 */
@Mapper
public interface KnowledgeArticleMapper extends BaseMapper<KnowledgeArticleEntity> {
}
