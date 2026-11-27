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
    /** 当前渠道基础价；price 为按消费者限购条件计算的可用结算单价。 */
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