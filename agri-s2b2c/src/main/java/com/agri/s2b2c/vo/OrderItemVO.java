package com.agri.s2b2c.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class OrderItemVO {
    private Long id;
    private Long productId;
    private String name;
    private String spec;
    private BigDecimal price;
    private Integer quantity;
    private BigDecimal totalAmount;
    private String image;
    private String traceCode;
}