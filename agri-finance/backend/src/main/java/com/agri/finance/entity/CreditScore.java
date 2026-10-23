package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("credit_score")
public class CreditScore {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String userId;

    private Integer compositeScore;

    private String creditLevel;

    private Integer businessAbilityScore;

    private Integer debtAbilityScore;

    private Integer creditRecordScore;

    private Integer stabilityScore;

    private BigDecimal availableAmount;

    private BigDecimal referenceRate;

    private Integer scoreChange;

    private String changeTrend;

    private Integer platformMonths;

    private BigDecimal totalTransactionAmount;

    private BigDecimal fulfillmentRate;

    private Integer overdueCount;

    private BigDecimal repurchaseRate;

    private String riskAlerts;

    private String improvementSuggestions;

    private LocalDateTime evaluationTime;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}