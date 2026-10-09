package com.agri.produce.internal.message;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

/**
 * 站内通知（任务/告警/质检/系统）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_message_notify")
public class MessageNotifyEntity extends ProduceBaseEntity {

    @TableId(value = "message_id", type = IdType.INPUT)
    private String messageId;

    /** 农场ID */
    private String farmId;

    /** 接收人 */
    private String receiverId;

    /** 消息类型 TASK/ALERT/QUALITY/SYSTEM */
    private String msgType;

    /** 标题 */
    private String title;

    /** 内容 */
    private String content;

    /** 业务ID */
    private String bizId;

    /** 已读 0否 1是 */
    private Integer readFlag;

    /** 发送时间 */
    private LocalDateTime sentAt;

    /** 阅读时间 */
    private LocalDateTime readAt;

    /** 渠道 INBOX/SMS/WECHAT */
    private String channel;

    /** 状态 1有效 0撤回 */
    private Integer status;
}
