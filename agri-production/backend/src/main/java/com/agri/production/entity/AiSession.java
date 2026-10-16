package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/** AI 问答会话。助手回复走规则式应答（见 AiChatServiceImpl）。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_ai_session")
public class AiSession extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("session_id")
    private String sessionId;

    @TableField("title")
    private String title;

    /** 消息条数 */
    @TableField("message_count")
    private Integer messageCount;
}
