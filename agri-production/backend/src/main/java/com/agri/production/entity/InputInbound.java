package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_input_inbound")
public class InputInbound {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("inbound_no")
    private String inboundNo;

    @TableField("product_id")
    private Long productId;

    @TableField("product_name")
    private String productName;

    @TableField("batch_no")
    private String batchNo;

    @TableField("inbound_quantity")
    private BigDecimal inboundQuantity;

    @TableField("unit")
    private String unit;

    @TableField("unit_price")
    private BigDecimal unitPrice;

    @TableField("total_amount")
    private BigDecimal totalAmount;

    @TableField("supplier_name")
    private String supplierName;

    @TableField("supplier_contact")
    private String supplierContact;

    @TableField("purchase_order_no")
    private String purchaseOrderNo;

    @TableField("inbound_date")
    private Date inboundDate;

    @TableField("inbound_type")
    private String inboundType;

    @TableField("warehouse_location")
    private String warehouseLocation;

    @TableField("production_date")
    private Date productionDate;

    @TableField("valid_until")
    private Date validUntil;

    @TableField("quantity_check")
    private Integer quantityCheck;

    @TableField("quality_check")
    private Integer qualityCheck;

    @TableField("handler")
    private String handler;

    @TableField("approver")
    private String approver;

    @TableField("approval_time")
    private Date approvalTime;

    @TableField("approval_status")
    private String approvalStatus;

    @TableField("remark")
    private String remark;

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
}