package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("repayment_plan")
public class RepaymentPlan {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String loanId;

    private String loanNo;

    private Integer period;

    private BigDecimal principal;

    private BigDecimal interest;

    private BigDecimal totalAmount;

    private LocalDateTime dueDate;

    private LocalDateTime paidDate;

    private String status;

    private BigDecimal paidPrincipal;

    private BigDecimal paidInterest;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}