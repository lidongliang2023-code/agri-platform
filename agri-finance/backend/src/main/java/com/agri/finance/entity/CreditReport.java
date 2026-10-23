package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("credit_report")
public class CreditReport {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String reportNo;

    private String userId;

    private String userName;

    private Integer compositeScore;

    private String creditLevel;

    private BigDecimal suggestedAmount;

    private BigDecimal referenceRate;

    private String dataSources;

    private String dimensionScores;

    private String riskAlerts;

    private String improvementSuggestions;

    private LocalDateTime evaluationTime;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}