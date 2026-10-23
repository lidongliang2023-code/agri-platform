package com.agri.s2b2c.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class CommissionVO {
    private Long id;
    private String orderNo;
    private BigDecimal amount;
    private BigDecimal rate;
    private String status;
    private LocalDateTime settleTime;
    private LocalDateTime createTime;
}