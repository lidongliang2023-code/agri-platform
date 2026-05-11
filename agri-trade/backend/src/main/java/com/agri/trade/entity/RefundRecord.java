package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_refund")
public class RefundRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("refund_no")
    private String refundNo;

    @TableField("order_id")
    private Long orderId;

    @TableField("order_no")
    private String orderNo;

    @TableField("payment_id")
    private Long paymentId;

    @TableField("refund_type")
    private String refundType;

    @TableField("refund_amount")
    private BigDecimal refundAmount;

    @TableField("refund_reason")
    private String refundReason;

    @TableField("refund_description")
    private String refundDescription;

    @TableField("applicant_type")
    private String applicantType;

    @TableField("applicant_id")
    private Long applicantId;

    @TableField("applicant_name")
    private String applicantName;

    @TableField("reviewer")
    private String reviewer;

    @TableField("review_time")
    private Date reviewTime;

    @TableField("review_remark")
    private String reviewRemark;

    @TableField("refund_status")
    private String refundStatus;

    @TableField("refund_time")
    private Date refundTime;

    @TableField("finish_time")
    private Date finishTime;

    @TableField("error_message")
    private String errorMessage;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;

    @TableField("update_by")
    private String updateBy;

    @TableField("update_time")
    private Date updateTime;
}