package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

/**
 * 商品 SKU。
 *
 * <p>商品主表保留汇总价格、总库存等字段，用于大厅排序、筛选和旧客户端兼容；
 * 每个具体可售规格的编码、价格、库存、单位与起订量以本表为准。</p>
 */
@Data
@TableName("agri_trade_product_sku")
public class ProductSku {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("product_id")
    private Long productId;

    @TableField("sku_code")
    private String skuCode;

    @TableField("sku_name")
    private String skuName;

    @TableField("barcode")
    private String barcode;

    @TableField("unit")
    private String unit;

    @TableField("price")
    private BigDecimal price;

    @TableField("stock_quantity")
    private BigDecimal stockQuantity;

    @TableField("min_order_quantity")
    private BigDecimal minOrderQuantity;

    @TableField("status")
    private Integer status;

    @TableField("sort_order")
    private Integer sortOrder;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;

    @TableField("update_by")
    private String updateBy;

    @TableField("update_time")
    private Date updateTime;
}
