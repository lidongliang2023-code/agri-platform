package com.agri.s2b2c.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CouponVO {
    private Long id;
    private String name;
    private String type;
    private BigDecimal amount;
    private BigDecimal discountRate;
    private BigDecimal minAmount;
    private Integer remainCount;
    private Integer perUserLimit;
    private LocalDate validStart;
    private LocalDate validEnd;
    private String status;
}