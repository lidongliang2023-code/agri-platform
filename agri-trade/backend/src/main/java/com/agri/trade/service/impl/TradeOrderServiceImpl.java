package com.agri.trade.service.impl;

import com.agri.trade.entity.Quote;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.QuoteMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.service.ITradeOrderService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class TradeOrderServiceImpl extends ServiceImpl<TradeOrderMapper, TradeOrder> implements ITradeOrderService {

    private final QuoteMapper quoteMapper;

    @Override
    @Transactional
    public TradeOrder createOrder(Long buyerId, String buyerName, Long sellerId, String sellerName,
                                  String productName, BigDecimal totalAmount, String deliveryAddress,
                                  Date deliveryDeadline, Long contractId) {
        TradeOrder order = new TradeOrder();
        order.setOrderNo("PO" + System.currentTimeMillis());
        order.setBuyerId(buyerId);
        order.setBuyerName(buyerName);
        order.setSellerId(sellerId);
        order.setSellerName(sellerName);
        order.setProductName(productName);
        order.setTotalAmount(totalAmount);
        order.setGoodsAmount(totalAmount);
        order.setDeliveryAddress(deliveryAddress);
        order.setDeliveryDeadline(deliveryDeadline);
        order.setContractId(contractId);
        order.setOrderStatus("pending");
        order.setPaymentStatus("unpaid");
        order.setDelFlag(0);
        order.setCreateTime(new Date());
        order.setUpdateTime(new Date());

        baseMapper.insert(order);

        return order;
    }

    @Override
    @Transactional
    public TradeOrder createOrderFromQuote(Long quoteId) {
        Quote quote = quoteMapper.selectById(quoteId);
        if (quote == null) {
            return null;
        }

        TradeOrder order = new TradeOrder();
        order.setOrderNo("PO" + System.currentTimeMillis());
        order.setBuyerId(quote.getBuyerId());
        order.setBuyerName(quote.getBuyerName());
        order.setSellerId(quote.getSellerId());
        order.setSellerName(quote.getSellerName());
        order.setProductName(quote.getProductName());
        order.setTotalAmount(quote.getQuoteAmount());
        order.setGoodsAmount(quote.getQuoteAmount());
        order.setDeliveryAddress(quote.getDeliveryAddress());
        order.setDeliveryDeadline(quote.getDeliveryDeadline());
        order.setOrderStatus("pending");
        order.setPaymentStatus("unpaid");
        order.setDelFlag(0);
        order.setCreateTime(new Date());
        order.setUpdateTime(new Date());

        baseMapper.insert(order);

        quote.setQuoteStatus("ordered");
        quoteMapper.updateById(quote);

        return order;
    }

    @Override
    @Transactional
    public boolean updateOrderStatus(Long orderId, String status) {
        TradeOrder order = baseMapper.selectById(orderId);
        if (order == null) {
            return false;
        }

        order.setOrderStatus(status);
        order.setUpdateTime(new Date());
        baseMapper.updateById(order);

        return true;
    }

    @Override
    @Transactional
    public boolean payOrder(Long orderId, String paymentMethod, BigDecimal paidAmount) {
        TradeOrder order = baseMapper.selectById(orderId);
        if (order == null) {
            return false;
        }

        order.setPaymentMethod(paymentMethod);
        order.setPaidAmount(paidAmount);
        order.setPaymentStatus("paid");
        order.setUpdateTime(new Date());
        baseMapper.updateById(order);

        return true;
    }

    @Override
    @Transactional
    public boolean confirmPayment(Long orderId) {
        TradeOrder order = baseMapper.selectById(orderId);
        if (order == null) {
            return false;
        }

        order.setPaymentStatus("confirmed");
        order.setOrderStatus("confirmed");
        order.setUpdateTime(new Date());
        baseMapper.updateById(order);

        return true;
    }

    @Override
    @Transactional
    public boolean shipOrder(Long orderId, Long logisticsId, String logisticsNo) {
        TradeOrder order = baseMapper.selectById(orderId);
        if (order == null) {
            return false;
        }

        order.setLogisticsId(logisticsId);
        order.setLogisticsNo(logisticsNo);
        order.setLogisticsStatus("shipped");
        order.setOrderStatus("shipped");
        order.setUpdateTime(new Date());
        baseMapper.updateById(order);

        return true;
    }

    @Override
    @Transactional
    public boolean confirmDelivery(Long orderId) {
        TradeOrder order = baseMapper.selectById(orderId);
        if (order == null) {
            return false;
        }

        order.setOrderStatus("completed");
        order.setBuyerConfirmed(1);
        order.setBuyerConfirmTime(new Date());
        order.setLogisticsStatus("delivered");
        order.setUpdateTime(new Date());
        baseMapper.updateById(order);

        return true;
    }

    @Override
    @Transactional
    public boolean cancelOrder(Long orderId, String cancelReason) {
        TradeOrder order = baseMapper.selectById(orderId);
        if (order == null) {
            return false;
        }

        order.setOrderStatus("cancelled");
        order.setRemark(cancelReason);
        order.setUpdateTime(new Date());
        baseMapper.updateById(order);

        return true;
    }

    @Override
    @Transactional
    public boolean applyRefund(Long orderId, BigDecimal refundAmount, String refundReason) {
        TradeOrder order = baseMapper.selectById(orderId);
        if (order == null) {
            return false;
        }

        order.setRefundAmount(refundAmount);
        order.setOrderStatus("refunding");
        order.setRemark(refundReason);
        order.setUpdateTime(new Date());
        baseMapper.updateById(order);

        return true;
    }

    @Override
    @Transactional
    public boolean confirmRefund(Long orderId) {
        TradeOrder order = baseMapper.selectById(orderId);
        if (order == null) {
            return false;
        }

        order.setOrderStatus("refunded");
        order.setUpdateTime(new Date());
        baseMapper.updateById(order);

        return true;
    }

    @Override
    @Transactional
    public boolean settleOrder(Long orderId) {
        TradeOrder order = baseMapper.selectById(orderId);
        if (order == null) {
            return false;
        }

        order.setSettleStatus("settled");
        order.setSettleTime(new Date());
        order.setUpdateTime(new Date());
        baseMapper.updateById(order);

        return true;
    }

    @Override
    public TradeOrder getOrderByNo(String orderNo) {
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getOrderNo, orderNo);
        wrapper.eq(TradeOrder::getDelFlag, 0);
        return baseMapper.selectOne(wrapper);
    }

    @Override
    public List<TradeOrder> getOrdersByBuyer(Long buyerId) {
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getBuyerId, buyerId);
        wrapper.eq(TradeOrder::getDelFlag, 0);
        wrapper.orderByDesc(TradeOrder::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<TradeOrder> getOrdersBySeller(Long sellerId) {
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getSellerId, sellerId);
        wrapper.eq(TradeOrder::getDelFlag, 0);
        wrapper.orderByDesc(TradeOrder::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<TradeOrder> getOrdersByStatus(String status) {
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getOrderStatus, status);
        wrapper.eq(TradeOrder::getDelFlag, 0);
        wrapper.orderByDesc(TradeOrder::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<TradeOrder> searchOrders(String keyword, String status, String timeRange) {
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getDelFlag, 0);

        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(TradeOrder::getOrderNo, keyword)
                    .or().like(TradeOrder::getProductName, keyword));
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(TradeOrder::getOrderStatus, status);
        }

        wrapper.orderByDesc(TradeOrder::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public Map<String, Object> getOrderStatistics(Long userId, String userType) {
        Map<String, Object> stats = new HashMap<>();

        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getDelFlag, 0);

        if ("buyer".equals(userType)) {
            wrapper.eq(TradeOrder::getBuyerId, userId);
        } else {
            wrapper.eq(TradeOrder::getSellerId, userId);
        }

        List<TradeOrder> orders = baseMapper.selectList(wrapper);

        stats.put("totalCount", orders.size());
        stats.put("totalAmount", orders.stream()
            .map(TradeOrder::getTotalAmount)
            .filter(a -> a != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add));

        stats.put("pendingCount", orders.stream()
            .filter(o -> "pending".equals(o.getOrderStatus()))
            .count());
        stats.put("completedCount", orders.stream()
            .filter(o -> "completed".equals(o.getOrderStatus()))
            .count());
        stats.put("cancelledCount", orders.stream()
            .filter(o -> "cancelled".equals(o.getOrderStatus()))
            .count());

        return stats;
    }

    @Override
    @Transactional
    public boolean updateLogisticsInfo(Long orderId, Long logisticsId, String logisticsNo, String logisticsStatus) {
        TradeOrder order = baseMapper.selectById(orderId);
        if (order == null) {
            return false;
        }

        order.setLogisticsId(logisticsId);
        order.setLogisticsNo(logisticsNo);
        order.setLogisticsStatus(logisticsStatus);
        order.setUpdateTime(new Date());
        baseMapper.updateById(order);

        return true;
    }
}