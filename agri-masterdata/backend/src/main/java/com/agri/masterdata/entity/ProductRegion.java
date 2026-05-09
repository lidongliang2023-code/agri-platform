package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("agri_md_product_region")
public class ProductRegion {

    @TableId(value = "region_id", type = IdType.ASSIGN_ID)
    private String regionId;

    @TableField("region_code")
    private String regionCode;

    @TableField("region_name")
    private String regionName;

    @TableField("region_type")
    private String regionType;

    @TableField("main_products")
    private String mainProducts;

    @TableField("description")
    private String description;

    @TableField("advantage")
    private String advantage;

    @TableField("capacity")
    private BigDecimal capacity;

    @TableField("output_ratio")
    private BigDecimal outputRatio;

    @TableField("status")
    private String status;

    @TableField("create_time")
    private LocalDateTime createTime;
}