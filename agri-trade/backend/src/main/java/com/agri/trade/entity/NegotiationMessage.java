package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;
import java.math.BigDecimal;

/** 在线洽谈消息。 */
@Data
@TableName("agri_trade_negotiation_message")
public class NegotiationMessage {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long negotiationId;
    private Long senderUserId;
    private String senderRole;
    private String senderName;
    private String messageType;
    private String content;
    private String attachmentUrl;
    private String businessType;
    private Long businessId;
    private String businessTitle;
    private String businessUrl;
    private BigDecimal businessQuantity;
    private String businessUnit;
    private BigDecimal businessPrice;
    private Integer readFlag;
    private LocalDateTime createTime;
}
