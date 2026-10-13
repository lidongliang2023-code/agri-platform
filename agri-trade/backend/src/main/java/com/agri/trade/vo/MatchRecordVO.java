package com.agri.trade.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

/**
 * 撮合记录（列表用）。
 *
 * <p>为什么不直接把 {@code MatchRecord} 实体返回给前端：那张表里只有 demandId / productId，
 * <b>没有商品名和供应商名</b>。前端表格的"产品名称""供应商"两列如果直接读实体字段，
 * 会是一列永远空白的数据 —— 接口 200、表格看着像"没数据"，这个坑本项目已经踩过多次。
 * 所以这里在服务端把名称一并补上再返回。</p>
 */
@Data
public class MatchRecordVO {

    private Long id;

    private String matchNo;

    private Long demandId;

    private String demandNo;

    private String demandName;

    private Long productId;

    private String productName;

    private String productCode;

    private Long sellerId;

    private String sellerName;

    private String matchType;

    private BigDecimal matchScore;

    private BigDecimal categoryScore;

    private BigDecimal priceScore;

    private BigDecimal distanceScore;

    private BigDecimal qualityScore;

    private String matchReason;

    private Integer recommendOrder;

    /** 该撮合后续走到哪一步（询价 / 订单），由记录上回写的字段决定 */
    private String inquiryStatus;

    private String orderStatus;

    private Long orderId;

    private Date createTime;
}
