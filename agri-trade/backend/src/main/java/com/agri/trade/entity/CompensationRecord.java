package com.agri.iot.entity.trade;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_compensation")
public class CompensationRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("compensation_no")
    private String compensationNo;

    @TableField("order_id")
    private Long orderId;

    @TableField("order_no")
    private String orderNo;

    @TableField("dispute_id")
    private Long disputeId;

    @TableField("compensation_type")
    private String compensationType;

    @TableField("compensation_reason")
    private String compensationReason;

    @TableField("applicant_type")
    private String applicantType;

    @TableField("applicant_id")
    private Long applicantId;

    @TableField("applicant_name")
    private String applicantName;

    @TableField("recipient_id")
    private Long recipientId;

    @TableField("recipient_name")
    private String recipientName;

    @TableField("compensation_amount")
    private BigDecimal compensationAmount;

    @TableField("compensation_status")
    private String compensationStatus;

    @TableField("reviewer")
    private String reviewer;

    @TableField("review_time")
    private Date reviewTime;

    @TableField("review_result")
    private String reviewResult;

    @TableField("review_remark")
    private String reviewRemark;

    @TableField("pay_time")
    private Date payTime;

    @TableField("transaction_id")
    private String transactionId;

    @TableField("pay_channel")
    private String payChannel;

    @TableField("remark")
    private String remark;

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