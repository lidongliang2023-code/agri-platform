package com.agri.s2b2c.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class CartVO {
    private Long id;
    private Long productId;
    private String name;
    private String spec;
    private BigDecimal price;
    /** 原价（= 商品价）；price 与 activityPrice 同时存在时，结算按 activityPrice。 */
    private BigDecimal originalPrice;
    private BigDecimal activityPrice;
    private String activityType;
    private LocalDateTime activityEndTime;
    private Integer quantity;
    private Boolean selected;
    private String image;
    private Integer stock;
    private Long shopId;
    private String shopName;
}