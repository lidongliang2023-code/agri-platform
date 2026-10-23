package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("asset")
public class Asset {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String assetNo;

    private String assetName;

    private String assetType;

    private String financingScenario;

    private BigDecimal amount;

    private BigDecimal expectedReturn;

    private Integer term;

    private BigDecimal pledgeRate;

    private String borrowerId;

    private String borrowerName;

    private String borrowerRating;

    private String collateralType;

    private Boolean iotMonitored;

    private BigDecimal aiRecommendationScore;

    private String recommendationReason;

    private String status;

    private BigDecimal availableAmount;

    private BigDecimal investedAmount;

    private String providerId;

    private LocalDateTime publishTime;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}