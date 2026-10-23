package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("message_notification")
public class MessageNotification {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String messageNo;

    private String userId;

    private String messageType;

    private String title;

    private String content;

    private String relatedBizType;

    private String relatedBizId;

    private Boolean isRead;

    private String priority;

    private String status;

    private LocalDateTime createdAt;

    private Integer delFlag;
}