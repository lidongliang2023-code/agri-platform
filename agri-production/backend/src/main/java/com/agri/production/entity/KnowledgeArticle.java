package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 农技知识库文章。
 *
 * <p><b>为什么不继承 BaseEntity</b>：知识库是**平台级内容**，没有"所属农场"这一维；
 * 基类会带上 farm_id，表里就得跟着加一列没有意义的字段（新版的列一致性检查器会强制要求它存在）。
 * 单列的 tenant_id / 审计字段在这里显式声明。</p>
 *
 * <p>对外编号用 {@code articleCode}（页面显示的「文章编号」就是它，接口的 {articleId} 也是它），
 * 与平台侧把业务编号作主键的做法一致 —— 页面上看到的是 DEMO-ART-001 而不是一个自增数字。</p>
 */
@Data
@TableName("agri_prod_knowledge_article")
public class KnowledgeArticle {

    /** 自增主键：仅内部使用，不出参 */
    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 文章编号（业务键）：出参名对齐前端契约的 articleId */
    @JsonProperty("articleId")
    @TableField("article_code")
    private String articleCode;

    @TableField("category_code")
    private String categoryCode;

    @TableField("title")
    private String title;

    @TableField("summary")
    private String summary;

    @TableField("content_url")
    private String contentUrl;

    @TableField("author")
    private String author;

    @TableField("source")
    private String source;

    @TableField("read_count")
    private Integer readCount;

    @JsonProperty("publishAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("publish_at")
    private LocalDateTime publishAt;

    /** 1 已发布 / 0 草稿 */
    @TableField("status")
    private Integer status;

    @TableField("tenant_id")
    private String tenantId;

    @JsonProperty("createdAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("create_time")
    private LocalDateTime createTime;

    @JsonProperty("updatedAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
