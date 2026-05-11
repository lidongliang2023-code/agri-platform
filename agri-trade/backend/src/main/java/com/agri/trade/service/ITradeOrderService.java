package com.agri.trade.service;

import com.agri.trade.entity.TradeOrder;
import com.baomidou.mybatisplus.extension.service.IService;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import java.util.Map;

public interface ITradeOrderService extends IService<TradeOrder> {

    TradeOrder createOrder(Long buyerId, String buyerName, Long sellerId, String sellerName,
                           String productName, BigDecimal totalAmount, String deliveryAddress,
                           Date deliveryDeadline, Long contractId);

    TradeOrder createOrderFromQuote(Long quoteId);

    boolean updateOrderStatus(Long orderId, String status);

    boolean payOrder(Long orderId, String paymentMethod, BigDecimal paidAmount);

    boolean confirmPayment(Long orderId);

    boolean shipOrder(Long orderId, Long logisticsId, String logisticsNo);

    boolean confirmDelivery(Long orderId);

    boolean cancelOrder(Long orderId, String cancelReason);

    boolean applyRefund(Long orderId, BigDecimal refundAmount, String refundReason);

    boolean confirmRefund(Long orderId);

    boolean settleOrder(Long orderId);

    TradeOrder getOrderByNo(String orderNo);

    List<TradeOrder> getOrdersByBuyer(Long buyerId);

    List<TradeOrder> getOrdersBySeller(Long sellerId);

    List<TradeOrder> getOrdersByStatus(String status);

    List<TradeOrder> searchOrders(String keyword, String status, String timeRange);

    Map<String, Object> getOrderStatistics(Long userId, String userType);

    boolean updateLogisticsInfo(Long orderId, Long logisticsId, String logisticsNo, String logisticsStatus);
}