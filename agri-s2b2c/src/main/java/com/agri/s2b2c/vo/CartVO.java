package com.agri.s2b2c.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class CartVO {
    private Long id;
    private Long productId;
    private String name;
    private String spec;
    private BigDecimal price;
    private Integer quantity;
    private Boolean selected;
    private String image;
    private Integer stock;
    private Long shopId;
    private String shopName;
}