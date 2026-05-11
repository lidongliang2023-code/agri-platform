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
@TableName("agri_prod_input_ledger")
public class InputMaterial extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("material_code")
    private String materialCode;

    @TableField("material_name")
    private String materialName;

    @TableField("material_type")
    private String materialType;

    @TableField("specification")
    private String specification;

    @TableField("unit")
    private String unit;

    @TableField("brand")
    private String brand;

    @TableField("supplier_id")
    private Long supplierId;

    @TableField("supplier_name")
    private String supplierName;

    @TableField("batch_number")
    private String batchNumber;

    @TableField("production_date")
    private java.time.LocalDate productionDate;

    @TableField("expire_date")
    private java.time.LocalDate expireDate;

    @TableField("purchase_price")
    private BigDecimal purchasePrice;

    @TableField("storage_location")
    private String storageLocation;

    @TableField("initial_stock")
    private BigDecimal initialStock;

    @TableField("current_stock")
    private BigDecimal currentStock;

    @TableField("min_stock")
    private BigDecimal minStock;

    @TableField("max_stock")
    private BigDecimal maxStock;

    @TableField("status")
    private String status;

    @TableField("remark")
    private String remark;
}