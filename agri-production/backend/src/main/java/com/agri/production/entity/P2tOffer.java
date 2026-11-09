package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 供给意向（Supply Offer）——生产端向交易端发出的可售供给要约。
 *
 * <p>只说「有什么、有多少、什么时候能出、什么等级」，不说价格。
 * 价格参考区间只作内部参考，不对外、不参与撮合。</p>
 */
@Data
@TableName("agri_p2t_offer")
public class P2tOffer {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("tenant_id")
    private String tenantId;
    @TableField("offer_no")
    private String offerNo;

    @TableField("batch_id")
    private Long batchId;
    @TableField("batch_no")
    private String batchNo;
    @TableField("crop_id")
    private Long cropId;
    @TableField("crop_name")
    private String cropName;
    @TableField("variety_name")
    private String varietyName;
    @TableField("category_code")
    private String categoryCode;
    @TableField("category_name")
    private String categoryName;
    @TableField("farm_id")
    private Long farmId;
    @TableField("farm_name")
    private String farmName;
    private String origin;
    private String unit;

    @TableField("available_qty")
    private BigDecimal availableQty;
    @TableField("reserved_qty")
    private BigDecimal reservedQty;
    @TableField("min_order_qty")
    private BigDecimal minOrderQty;
    @TableField("delivery_type")
    private String deliveryType;

    @JsonFormat(pattern = "yyyy-MM-dd")
    @TableField("window_start")
    private LocalDate windowStart;
    @JsonFormat(pattern = "yyyy-MM-dd")
    @TableField("window_end")
    private LocalDate windowEnd;

    @TableField("grade_a_ratio")
    private BigDecimal gradeARatio;
    @TableField("grade_b_ratio")
    private BigDecimal gradeBRatio;
    @TableField("grade_c_ratio")
    private BigDecimal gradeCRatio;

    @TableField("quality_no")
    private String qualityNo;
    @JsonFormat(pattern = "yyyy-MM-dd")
    @TableField("quality_valid_until")
    private LocalDate qualityValidUntil;
    @TableField("trace_code_seg")
    private String traceCodeSeg;
    @TableField("price_ref_min")
    private BigDecimal priceRefMin;
    @TableField("price_ref_max")
    private BigDecimal priceRefMax;

    /** PENDING / APPROVED / REJECTED */
    @TableField("audit_status")
    private String auditStatus;
    @TableField("audit_remark")
    private String auditRemark;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("audit_time")
    private LocalDateTime auditTime;
    private String auditor;

    /** PENDING 待审核 / LISTED 已上架 / SOLD 已售罄 / CLOSED 已关闭 */
    @TableField("trade_status")
    private String tradeStatus;
    @TableField("product_code")
    private String productCode;
    @TableField("product_name")
    private String productName;
    @TableField("listed_qty")
    private BigDecimal listedQty;
    @TableField("listed_price")
    private BigDecimal listedPrice;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("listed_time")
    private LocalDateTime listedTime;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("publish_time")
    private LocalDateTime publishTime;

    private String remark;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("create_time")
    private LocalDateTime createTime;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

    /** 剩余可售 = 可供量 − 已认购（页面直接展示，不落库） */
    public BigDecimal getRemainingQty() {
        BigDecimal available = availableQty == null ? BigDecimal.ZERO : availableQty;
        BigDecimal reserved = reservedQty == null ? BigDecimal.ZERO : reservedQty;
        return available.subtract(reserved).max(BigDecimal.ZERO);
    }
}
