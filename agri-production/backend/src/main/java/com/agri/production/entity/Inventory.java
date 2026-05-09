package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_inventory")
public class Inventory {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("inventory_no")
    private String inventoryNo;

    @TableField("batch_no")
    private String batchNo;

    @TableField("farm_id")
    private Long farmId;

    @TableField("product_type")
    private String productType;

    @TableField("product_id")
    private Long productId;

    @TableField("product_name")
    private String productName;

    @TableField("variety_name")
    private String varietyName;

    @TableField("warehouse_type")
    private String warehouseType;

    @TableField("warehouse_location")
    private String warehouseLocation;

    @TableField("quantity")
    private BigDecimal quantity;

    @TableField("unit")
    private String unit;

    @TableField("quality_grade")
    private String qualityGrade;

    @TableField("production_date")
    private Date productionDate;

    @TableField("inbound_date")
    private Date inboundDate;

    @TableField("shelf_life_days")
    private Integer shelfLifeDays;

    @TableField("expire_date")
    private Date expireDate;

    @TableField("alert_status")
    private String alertStatus;

    @TableField("alert_days_before")
    private Integer alertDaysBefore;

    @TableField("last_check_date")
    private Date lastCheckDate;

    @TableField("last_quantity")
    private BigDecimal lastQuantity;

    @TableField("version")
    private Integer version;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;

    @TableField("update_by")
    private String updateBy;

    @TableField("update_time")
    private Date updateTime;

    @TableField("remark")
    private String remark;
}