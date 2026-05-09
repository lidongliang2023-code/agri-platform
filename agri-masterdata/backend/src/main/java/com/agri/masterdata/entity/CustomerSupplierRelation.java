package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("agri_md_customer_supplier_relation")
public class CustomerSupplierRelation {

    @TableId(value = "relation_id", type = IdType.ASSIGN_ID)
    private String relationId;

    @TableField("customer_id")
    private String customerId;

    @TableField("supplier_id")
    private String supplierId;

    @TableField("relation_type")
    private String relationType;

    @TableField("cooperation_level")
    private String cooperationLevel;

    @TableField("start_date")
    private LocalDateTime startDate;

    @TableField("end_date")
    private LocalDateTime endDate;

    @TableField("transaction_count")
    private Integer transactionCount;

    @TableField("total_amount")
    private BigDecimal totalAmount;

    @TableField("avg_unit_price")
    private BigDecimal avgUnitPrice;

    @TableField("payment_status")
    private String paymentStatus;

    @TableField("dispute_count")
    private Integer disputeCount;

    @TableField("status")
    private String status;

    @TableField("create_time")
    private LocalDateTime createTime;
}