package com.agri.trade.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Map;

@Data
public class MatchResultVO {

    private Long matchId;

    private Long demandId;

    private String demandNo;

    private Long productId;

    private String productName;

    private String productCode;

    private Long sellerId;

    private String sellerName;

    private BigDecimal matchScore;

    private String matchLevel;

    private String matchReason;

    private Map<String, Double> dimensionScores;

    private BigDecimal categoryScore;

    private BigDecimal priceScore;

    private BigDecimal distanceScore;

    private BigDecimal qualityScore;

    private BigDecimal reputationScore;

    private Integer recommendOrder;

    private String inquiryStatus;

    private String orderStatus;
}