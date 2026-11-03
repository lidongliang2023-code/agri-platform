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
    /**
     * 活动价（当前只有秒杀）。price 始终是原价，前端看到 activityPrice 才展示活动价与倒计时，
     * 下单时后端按同一套规则重算，避免「页面价 ≠ 结算价」。
     */
    private BigDecimal activityPrice;
    private String activityType;
    private LocalDateTime activityEndTime;
    private Integer activityRemainStock;
    private Integer activityLimit;
    private String categoryName;
    private String supplierName;
    private LocalDateTime createTime;
    /** 渠道零售价（空=按商品价）；仅渠道货架接口返回 */
    private BigDecimal retailPrice;
    /** 渠道实际售价：retailPrice 优先，否则 price */
    private BigDecimal effectivePrice;
    /** 渠道货架：ON / OFF */
    private String shelfStatus;
    private Boolean distributionEnabled;
    private Integer maxChannels;
    private BigDecimal minRetailPrice;
    private BigDecimal maxRetailPrice;
    /** 限售区域（省级）；空=全国不限，仅渠道商品池返回 */
    private List<String> regionNames;
}