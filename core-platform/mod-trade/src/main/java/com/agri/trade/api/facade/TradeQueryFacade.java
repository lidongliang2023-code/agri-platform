package com.agri.trade.api.facade;

import com.agri.trade.api.dto.TradeOrderDTO;

/**
 * 交易域 OHS 查询门面。
 */
public interface TradeQueryFacade {

    TradeOrderDTO getOrder(Long orderId);
}
