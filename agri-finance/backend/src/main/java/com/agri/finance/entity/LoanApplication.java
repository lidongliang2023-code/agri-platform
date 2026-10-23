package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("loan_application")
public class LoanApplication {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String applicationNo;

    private String userId;

    private String userName;

    private String productType;

    private BigDecimal applyAmount;

    private Integer applyTerm;

    private String repaymentMethod;

    private String fundPurpose;

    private String repaymentSource;

    private BigDecimal assetAmount;

    private String collateralInfo;

    private String contactName;

    private String contactPhone;

    private String evidenceUrl;

    private String status;

    private String creditScore;

    private String creditLevel;

    private BigDecimal suggestedAmount;

    private BigDecimal suggestedRate;

    private String aiReviewResult;

    private BigDecimal aiConfidence;

    private String reviewOpinion;

    private String reviewerId;

    private String reviewerName;

    private BigDecimal actualAmount;

    private BigDecimal actualRate;

    private LocalDateTime applyTime;

    private LocalDateTime reviewTime;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}
