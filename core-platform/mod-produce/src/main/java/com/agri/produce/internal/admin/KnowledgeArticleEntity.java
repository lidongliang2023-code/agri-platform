package com.agri.produce.internal.admin;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

/**
 * 农技知识文章（种植/植保/政策）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_knowledge_article")
public class KnowledgeArticleEntity extends ProduceBaseEntity {

    @TableId(value = "article_id", type = IdType.INPUT)
    private String articleId;

    /** 分类编码 */
    private String categoryCode;

    /** 标题 */
    private String title;

    /** 摘要 */
    private String summary;

    /** 正文/附件 */
    private String contentUrl;

    /** 作者 */
    private String author;

    /** 来源 */
    private String source;

    /** 阅读数 */
    private Integer readCount;

    /** 发布时间 */
    private LocalDateTime publishAt;

    /** 状态 1已发布 0草稿 */
    private Integer status;
}
