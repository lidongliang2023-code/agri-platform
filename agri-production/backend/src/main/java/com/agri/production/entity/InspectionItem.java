package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_inspection_item")
public class InspectionItem extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("item_code")
    private String itemCode;

    @TableField("item_name")
    private String itemName;

    @TableField("category")
    private String category;

    @TableField("unit")
    private String unit;

    @TableField("standard_value")
    private String standardValue;

    @TableField("tolerance")
    private String tolerance;

    @TableField("inspection_method")
    private String inspectionMethod;

    @TableField("is_required")
    private Integer isRequired;

    @TableField("sort_order")
    private Integer sortOrder;

    @TableField("description")
    private String description;

    @TableField("is_enabled")
    private Integer isEnabled;
}