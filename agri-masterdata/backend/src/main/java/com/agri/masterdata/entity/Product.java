package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_product")
public class Product extends BaseEntity {

    private String productCode;

    private String productName;

    private Long categoryId;

    private String categoryPath;

    private String brand;

    private String unit;

    private String origin;

    private String specJson;

    private BigDecimal price;

    private BigDecimal minOrderQty;

    private String imageUrls;

    private String description;

    private String status;

    private String auditStatus;

    private Integer delFlag;

    private String tenantId;
}
