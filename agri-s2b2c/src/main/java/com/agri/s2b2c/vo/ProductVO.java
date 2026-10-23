package com.agri.s2b2c.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class ProductVO {
    private Long id;
    private String name;
    private String sellingPoint;
    private String origin;
    private String grade;
    private String spec;
    private String unit;
    private BigDecimal price;
    private BigDecimal originalPrice;
    private Integer stock;
    private Integer sales;
    private BigDecimal commissionRate;
    private List<String> images;
    private String certifications;
    private String status;
    private String categoryName;
    private String supplierName;
    private LocalDateTime createTime;
}