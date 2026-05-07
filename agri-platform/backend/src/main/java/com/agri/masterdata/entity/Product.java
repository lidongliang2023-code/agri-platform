package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_product")
public class Product extends BaseEntity {

    private String productCode;

    private String productName;

    private Long categoryId;

    private String brand;

    private String unit;

    private String origin;

    private String specJson;

    private BigDecimal price;

    private String imageUrls;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}
