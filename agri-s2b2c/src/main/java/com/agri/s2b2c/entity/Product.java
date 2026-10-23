package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("s2b2c_product")
public class Product {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long supplierId;
    private Long channelId;
    private Long categoryId;
    private String name;
    private String sellingPoint;
    private String origin;
    private String grade;
    private String shelfLife;
    private String spec;
    private String unit;
    private BigDecimal price;
    private BigDecimal originalPrice;
    private BigDecimal costPrice;
    private Integer stock;
    private Integer stockWarning;
    private BigDecimal commissionRate;
    private String images;
    private String videoUrl;
    private String detail;
    private String freightTemplate;
    private String deliveryTime;
    private String certifications;
    private String traceabilityInfo;
    private String status;
    private LocalDateTime auditTime;
    private String auditOpinion;
    private Integer sales;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}