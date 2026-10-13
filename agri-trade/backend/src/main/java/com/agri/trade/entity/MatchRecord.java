package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_match_record")
public class MatchRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("match_no")
    private String matchNo;

    @TableField("demand_id")
    private Long demandId;

    /**
     * 采购方主体ID。
     *
     * <p>表里是 NOT NULL，但实体此前没有这个字段 —— 撮合记录一落库就报
     * "Field 'buyer_id' doesn't have a default value"。</p>
     */
    @TableField("buyer_id")
    private Long buyerId;

    @TableField("product_id")
    private Long productId;

    /**
     * 供应商主体ID（取自被匹配的货源）。
     *
     * <p>表里是 NOT NULL，实体同样漏了这个字段 —— 与 buyer_id 是同一处缺口。</p>
     */
    @TableField("seller_id")
    private Long sellerId;

    @TableField("match_type")
    private String matchType;

    @TableField("match_score")
    private BigDecimal matchScore;

    @TableField("category_score")
    private BigDecimal categoryScore;

    @TableField("price_score")
    private BigDecimal priceScore;

    @TableField("distance_score")
    private BigDecimal distanceScore;

    @TableField("quality_score")
    private BigDecimal qualityScore;

    @TableField("match_reason")
    private String matchReason;

    @TableField("recommend_order")
    private Integer recommendOrder;

    @TableField("buyer_viewed")
    private Integer buyerViewed;

    @TableField("buyer_view_time")
    private Date buyerViewTime;

    @TableField("seller_viewed")
    private Integer sellerViewed;

    @TableField("seller_view_time")
    private Date sellerViewTime;

    @TableField("inquiry_status")
    private String inquiryStatus;

    @TableField("order_status")
    private String orderStatus;

    @TableField("order_id")
    private Long orderId;

    @TableField("convert_time")
    private Date convertTime;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_time")
    private Date createTime;
}
