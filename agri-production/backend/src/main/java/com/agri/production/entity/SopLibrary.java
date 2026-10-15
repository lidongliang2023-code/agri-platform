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
 * 运营端 SOP 规程库。
 *
 * <p>与用户端的 {@link SopTemplate}（作业标准模板）**不是同一张表**：这张是运营方维护的
 * "规程库"（带版本号、正文链接、适用区域、发布人），页面「SOP管理」读的是这些字段；
 * 那个是农场自己的作业模板。平台侧同样是两张表（prod_sop_library / prod_sop_template）。</p>
 *
 * <p>不继承 BaseEntity 的理由同 {@link KnowledgeArticle}：规程库是平台级内容，没有农场维度。</p>
 *
 * <p>{@code sopId} 出参用自增 id 的字符串形式（页面只把它当行键用），{@code sopCode} 单独给 ——
 * 页面「规程编码」列读的是 sopCode，两个名字各有用途，不是同一个值的两份拷贝。</p>
 */
@Data
@TableName("agri_prod_sop_library")
public class SopLibrary {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("sop_code")
    private String sopCode;

    @TableField("crop_id")
    private String cropId;

    @TableField("sop_name")
    private String sopName;

    @TableField("sop_type")
    private String sopType;

    @TableField("version_no")
    private String versionNo;

    @TableField("content_url")
    private String contentUrl;

    @TableField("stage_seq")
    private Integer stageSeq;

    @TableField("applicable_region")
    private String applicableRegion;

    @TableField("publisher")
    private String publisher;

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

    /** 出参补充：sopId = 自增 id 的字符串形式（页面行键用） */
    @JsonProperty("sopId")
    public String getSopId() {
        return id == null ? null : String.valueOf(id);
    }
}
