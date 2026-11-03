package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 采购方与供应商店铺之间的在线洽谈会话。 */
@Data
@TableName("agri_trade_negotiation")
public class Negotiation {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String conversationNo;
    private Long buyerUserId;
    private String buyerName;
    private Long sellerId;
    private String sellerName;
    private Long productId;
    private String productName;
    private String lastMessage;
    private LocalDateTime lastMessageTime;
    private Integer buyerUnread;
    private Integer sellerUnread;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
