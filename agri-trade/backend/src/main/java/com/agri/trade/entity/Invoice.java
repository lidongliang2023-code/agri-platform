package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

/** 买家开票申请（一笔订单一张）。 */
@Data
@TableName("agri_trade_invoice")
public class Invoice {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String invoiceNo;
    private Long orderId;
    private String orderNo;
    private Long buyerId;
    private String buyerName;
    private Long sellerId;
    private String sellerName;
    private BigDecimal amount;
    private String invoiceType;
    private String title;
    private String taxNo;
    /** pending / issued / rejected */
    private String invoiceStatus;
    private Date applyTime;
    private Date issueTime;
    private String remark;
    private Integer delFlag;
    private Date createTime;
    private Date updateTime;
}
