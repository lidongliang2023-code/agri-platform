package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("overdue_record")
public class OverdueRecord {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String overdueNo;

    private String loanId;

    private String loanNo;

    private String userId;

    private String userName;

    private String productType;

    private BigDecimal overduePrincipal;

    private BigDecimal overdueInterest;

    private BigDecimal overdueAmount;

    private Integer overdueDays;

    private String overdueStage;

    private String collectorId;

    private String collectorName;

    private String status;

    private String overdueReason;

    private LocalDateTime overdueDate;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}