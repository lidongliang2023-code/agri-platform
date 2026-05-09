package com.agri.iot.entity.trade;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_payment")
public class PaymentRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("payment_no")
    private String paymentNo;

    @TableField("order_id")
    private Long orderId;

    @TableField("order_no")
    private String orderNo;

    @TableField("payer_id")
    private Long payerId;

    @TableField("payer_name")
    private String payerName;

    @TableField("payee_id")
    private Long payeeId;

    @TableField("payee_name")
    private String payeeName;

    @TableField("payment_type")
    private String paymentType;

    @TableField("amount")
    private BigDecimal amount;

    @TableField("actual_amount")
    private BigDecimal actualAmount;

    @TableField("payment_method")
    private String paymentMethod;

    @TableField("payment_channel")
    private String paymentChannel;

    @TableField("transaction_id")
    private String transactionId;

    @TableField("payment_status")
    private String paymentStatus;

    @TableField("payment_time")
    private Date paymentTime;

    @TableField("notify_time")
    private Date notifyTime;

    @TableField("notify_content")
    private String notifyContent;

    @TableField("idempotent_key")
    private String idempotentKey;

    @TableField("client_ip")
    private String clientIp;

    @TableField("error_code")
    private String errorCode;

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