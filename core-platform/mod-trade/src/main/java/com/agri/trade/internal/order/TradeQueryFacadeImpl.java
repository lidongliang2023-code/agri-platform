package com.agri.trade.internal.order;

import com.agri.trade.api.dto.TradeOrderDTO;
import com.agri.trade.api.facade.TradeQueryFacade;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 交易域 OHS 查询门面实现。
 */
@Service
@RequiredArgsConstructor
public class TradeQueryFacadeImpl implements TradeQueryFacade {

    private final TradeOrderMapper orderMapper;

    @Override
    public TradeOrderDTO getOrder(Long orderId) {
        TradeOrderEntity order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new BusinessException(ErrorCode.ORDER_NOT_FOUND);
        }
        return new TradeOrderDTO(order.getId(), order.getOrderNo(), order.getBuyerMerchantId(),
                order.getSellerMerchantId(), order.getProductId(), order.getProductName(),
                order.getQuantity(), order.getUnitPrice(), order.getAmount(), order.getStatus(),
                order.getTraceCode());
    }
}
