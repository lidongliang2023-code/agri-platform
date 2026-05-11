package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_inventory")
public class Inventory extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("inventory_code")
    private String inventoryCode;

    @TableField("harvest_id")
    private Long harvestId;

    @TableField("harvest_code")
    private String harvestCode;

    @TableField("crop_name")
    private String cropName;

    @TableField("quality_grade")
    private String qualityGrade;

    @TableField("batch_number")
    private String batchNumber;

    @TableField("initial_quantity")
    private BigDecimal initialQuantity;

    @TableField("current_quantity")
    private BigDecimal currentQuantity;

    @TableField("unit")
    private String unit;

    @TableField("storage_location")
    private String storageLocation;

    @TableField("warehouse_code")
    private String warehouseCode;

    @TableField("storage_date")
    private java.time.LocalDate storageDate;

    @TableField("expire_date")
    private java.time.LocalDate expireDate;

    @TableField("status")
    private String status;

    @TableField("trace_code")
    private String traceCode;

    @TableField("remark")
    private String remark;
}