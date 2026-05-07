package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_product_category")
public class ProductCategory extends BaseEntity {

    private String categoryName;

    private Long parentId;

    private String ancestors;

    private Integer orderNum;

    private String categoryCode;

    private String icon;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}
