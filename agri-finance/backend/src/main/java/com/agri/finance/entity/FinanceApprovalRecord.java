package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("finance_approval_record")
public class FinanceApprovalRecord {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String applicationId;

    private String providerId;

    private String providerName;

    private String decision;

    private BigDecimal approvedAmount;

    private BigDecimal approvedRate;

    private String opinion;

    private String reviewerId;

    private String reviewerName;

    private LocalDateTime createdAt;
}
