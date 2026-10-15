package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 站内消息通知（用户端「消息中心」）。
 *
 * <p>主键是自增 id，业务键是 {@code message_id} —— 与农场/地块同口径（本服务表用自增主键 +
 * 业务编号；页面只认 messageId）。</p>
 */
@Data
@TableName("agri_prod_message_notify")
public class MessageNotify {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("message_id")
    private String messageId;

    @TableField("tenant_id")
    private String tenantId;

    /** 关联农场（本服务农场主键，字符串存） */
    @TableField("farm_id")
    private String farmId;

    /** 接收人（平台侧成员编号） */
    @TableField("receiver_id")
    private String receiverId;

    /** SYSTEM / TASK / ALERT / QUALITY —— 数值编码由页面归一，后端不转 */
    @TableField("msg_type")
    private String msgType;

    @TableField("title")
    private String title;

    @TableField("content")
    private String content;

    @TableField("biz_id")
    private String bizId;

    /** 指定跳转路径；为空时页面按 bizId 兜底 */
    @TableField("link_path")
    private String linkPath;

    /** 已读 0 否 / 1 是 */
    @TableField("read_flag")
    private Integer readFlag;

    @TableField("sent_at")
    private LocalDateTime sentAt;

    @TableField("read_at")
    private LocalDateTime readAt;

    /** INBOX / SMS / WECHAT */
    @TableField("channel")
    private String channel;

    /** 1 有效 / 0 撤回 */
    @TableField("status")
    private Integer status;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
