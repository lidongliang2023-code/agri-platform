package com.agri.iot.entity.trade;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_order_item")
public class OrderItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("order_id")
    private Long orderId;

    @TableField("product_id")
    private Long productId;

    @TableField("product_name")
    private String productName;

    @TableField("category_id")
    private Long categoryId;

    @TableField("category_name")
    private String categoryName;

    @TableField("variety")
    private String variety;

    @TableField("spec_level")
    private String specLevel;

    @TableField("unit")
    private String unit;

    @TableField("quantity")
    private BigDecimal quantity;

    @TableField("unit_price")
    private BigDecimal unitPrice;

    @TableField("total_price")
    private BigDecimal totalPrice;

    @TableField("origin_province")
    private String originProvince;

    @TableField("origin_city")
    private String originCity;

    @TableField("harvest_batch_no")
    private String harvestBatchNo;

    @TableField("trace_code")
    private String traceCode;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;
}