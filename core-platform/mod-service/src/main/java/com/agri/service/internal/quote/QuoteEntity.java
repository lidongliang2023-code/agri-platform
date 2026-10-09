package com.agri.service.internal.quote;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 行情报价（大数据行情 v1）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("svc_quote")
public class QuoteEntity extends BaseEntity {

    private String productName;
    private String category;
    private BigDecimal price;
    /** 环比涨跌 % */
    private BigDecimal changePct;
    /** 数据来源：产地批发 / 批发市场 / 平台成交 */
    private String source;
    private LocalDateTime quotedAt;
}
