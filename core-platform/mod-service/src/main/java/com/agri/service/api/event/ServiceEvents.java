package com.agri.service.api.event;

import java.math.BigDecimal;

/**
 * 服务域事件契约。
 */
public final class ServiceEvents {

    /** 行情已更新 → 撮合交易（参考价）、供应链金融（质押价格）、行情推送服务 */
    public static final String QUOTE_UPDATED = "quote.updated";

    private ServiceEvents() {
    }

    public record QuoteUpdated(Long quoteId, String productName, String category, BigDecimal price,
                               BigDecimal changePct, Long marketId, String quotedAt) {
    }
}
