package com.agri.production.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class TraceRecordVO {

    private Long id;

    private String traceCode;

    private String traceType;

    private String traceTypeName;

    private LocalDateTime traceTime;

    private String operator;

    private String location;

    private BigDecimal latitude;

    private BigDecimal longitude;

    private String content;

    private String contentJson;

    private String photos;

    private String blockchainTxHash;

    private Integer sortOrder;
}