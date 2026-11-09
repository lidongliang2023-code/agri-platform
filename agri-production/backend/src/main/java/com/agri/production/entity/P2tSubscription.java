package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 认购回写流水：交易端每成交一笔（支付成功/取消/释放）就往这里落一条。
 *
 * <p>幂等键 = orderNo + eventType：同一订单同一事件重复投递不会重复累加认购量。
 * 回写字段不含成交价格 —— 价格属交易端商业数据。</p>
 */
@Data
@TableName("agri_p2t_subscription")
public class P2tSubscription {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("tenant_id")
    private String tenantId;
    @TableField("offer_no")
    private String offerNo;
    @TableField("batch_no")
    private String batchNo;
    @TableField("order_no")
    private String orderNo;
    @TableField("buyer_name")
    private String buyerName;
    @TableField("buyer_type")
    private String buyerType;
    private BigDecimal qty;
    private String grade;

    @JsonFormat(pattern = "yyyy-MM-dd")
    @TableField("lock_from")
    private LocalDate lockFrom;
    @JsonFormat(pattern = "yyyy-MM-dd")
    @TableField("lock_to")
    private LocalDate lockTo;

    /** ORDER_PAID / ORDER_CANCELLED / RELEASED / SHORT_SHIPPED */
    @TableField("event_type")
    private String eventType;
    /** SUCCESS / FAILED / RETRYING */
    @TableField("writeback_status")
    private String writebackStatus;
    @TableField("writeback_message")
    private String writebackMessage;
    @TableField("idempotent_key")
    private String idempotentKey;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("paid_at")
    private LocalDateTime paidAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("create_time")
    private LocalDateTime createTime;
}
