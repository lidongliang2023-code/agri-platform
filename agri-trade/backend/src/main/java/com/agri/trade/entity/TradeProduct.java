package com.agri.iot.entity.trade;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_product")
public class TradeProduct {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("product_code")
    private String productCode;

    @TableField("product_name")
    private String productName;

    @TableField("category_id")
    private Long categoryId;

    @TableField("category_name")
    private String categoryName;

    @TableField("seller_id")
    private Long sellerId;

    @TableField("seller_name")
    private String sellerName;

    @TableField("variety")
    private String variety;

    @TableField("origin_province")
    private String originProvince;

    @TableField("origin_city")
    private String originCity;

    @TableField("origin_district")
    private String originDistrict;

    @TableField("origin_address")
    private String originAddress;

    @TableField("spec_level")
    private String specLevel;

    @TableField("spec_size")
    private String specSize;

    @TableField("unit")
    private String unit;

    @TableField("stock_quantity")
    private BigDecimal stockQuantity;

    @TableField("price_min")
    private BigDecimal priceMin;

    @TableField("price_max")
    private BigDecimal priceMax;

    @TableField("price")
    private BigDecimal price;

    @TableField("price_type")
    private String priceType;

    @TableField("min_order_quantity")
    private BigDecimal minOrderQuantity;

    @TableField("harvest_batch_no")
    private String harvestBatchNo;

    @TableField("certification_json")
    private String certificationJson;

    @TableField("quality_report_url")
    private String qualityReportUrl;

    @TableField("description")
    private String description;

    @TableField("video_url")
    private String videoUrl;

    @TableField("view_count")
    private Integer viewCount;

    @TableField("favorite_count")
    private Integer favoriteCount;

    @TableField("inquiry_count")
    private Integer inquiryCount;

    @TableField("match_score")
    private BigDecimal matchScore;

    @TableField("publish_status")
    private String publishStatus;

    @TableField("audit_remark")
    private String auditRemark;

    @TableField("audit_time")
    private Date auditTime;

    @TableField("auditor")
    private String auditor;

    @TableField("valid_until")
    private Date validUntil;

    @TableField("status")
    private Integer status;

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