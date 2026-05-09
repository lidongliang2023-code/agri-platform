package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_input_outbound")
public class InputOutbound {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("outbound_no")
    private String outboundNo;

    @TableField("product_id")
    private Long productId;

    @TableField("product_name")
    private String productName;

    @TableField("batch_no")
    private String batchNo;

    @TableField("outbound_quantity")
    private BigDecimal outboundQuantity;

    @TableField("unit")
    private String unit;

    @TableField("outbound_date")
    private Date outboundDate;

    @TableField("outbound_type")
    private String outboundType;

    @TableField("task_id")
    private Long taskId;

    @TableField("plot_id")
    private Long plotId;

    @TableField("plot_name")
    private String plotName;

    @TableField("applicant")
    private String applicant;

    @TableField("approver")
    private String approver;

    @TableField("approval_time")
    private Date approvalTime;

    @TableField("approval_status")
    private String approvalStatus;

    @TableField("warehouse_location")
    private String warehouseLocation;

    @TableField("purpose")
    private String purpose;

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