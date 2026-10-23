package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("loan")
public class Loan {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String loanNo;

    private String applicationId;

    private String userId;

    private String productType;

    private BigDecimal amount;

    private BigDecimal rate;

    private Integer term;

    private String repaymentMethod;

    private String status;

    private BigDecimal remainingAmount;

    private BigDecimal paidAmount;

    private BigDecimal interestAmount;

    private LocalDateTime loanDate;

    private LocalDateTime dueDate;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}