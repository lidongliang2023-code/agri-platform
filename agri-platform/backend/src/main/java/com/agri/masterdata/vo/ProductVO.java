package com.agri.masterdata.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class ProductVO {

    private Long id;

    private String productCode;

    private String productName;

    private Long categoryId;

    private String categoryName;

    private String brand;

    private String unit;

    private String origin;

    private String specJson;

    private BigDecimal price;

    private String imageUrls;

    private Integer status;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String remark;
}
