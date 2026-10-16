package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/** AI 问答消息（engine 标明回答来源：本部署恒为 rule-based）。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_ai_message")
public class AiMessage extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("message_id")
    private String messageId;

    @TableField("session_id")
    private String sessionId;

    /** user / assistant */
    @TableField("role")
    private String role;

    @TableField("content")
    private String content;

    /** 回答来源：rule-based（本部署唯一取值） */
    @TableField("engine")
    private String engine;

    /** 引用数据来源（逗号分隔） */
    @TableField("ref_doc_ids")
    private String refDocIds;
}
