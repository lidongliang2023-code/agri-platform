package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_product_attribute")
public class ProductAttribute extends BaseEntity {

    private Long categoryId;

    private String attributeCode;

    private String attributeName;

    private String attributeType;

    private String unit;

    private String options;

    private Integer sortOrder;

    private Integer isRequired;

    private Integer isUnique;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}