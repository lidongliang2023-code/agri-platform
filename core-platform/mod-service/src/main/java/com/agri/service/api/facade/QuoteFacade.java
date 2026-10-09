package com.agri.service.api.facade;

import java.math.BigDecimal;

/**
 * 行情 OHS 门面：撮合参考价、金融质押估值消费。
 */
public interface QuoteFacade {

    /** 指定品名的最新行情价（无数据返回 null） */
    BigDecimal latestPrice(String productName);
}
