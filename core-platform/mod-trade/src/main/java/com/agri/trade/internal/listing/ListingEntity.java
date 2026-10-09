package com.agri.trade.internal.listing;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/**
 * 挂牌（撮合交易 B2B 大宗 MVP）：供货/求购挂牌，market_id 内建。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("trade_listing")
public class ListingEntity extends BaseEntity {

    private String listingNo;
    /** SELL=供货挂牌 BUY=求购挂牌 */
    private String type;
    private Long merchantId;
    private Long productId;
    private String productName;
    private BigDecimal quantity;
    private BigDecimal price;
    /** OPEN=挂牌中 MATCHED=已成交 CLOSED=已关闭 */
    private String status;
}
