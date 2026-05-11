package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.OrderItem;
import com.agri.trade.entity.PaymentRecord;
import com.agri.trade.entity.RefundRecord;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.OrderItemMapper;
import com.agri.trade.mapper.PaymentRecordMapper;
import com.agri.trade.mapper.RefundRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trade/order")
@RequiredArgsConstructor
public class OrderController {

    private final TradeOrderMapper orderMapper;
    private final OrderItemMapper itemMapper;
    private final PaymentRecordMapper paymentMapper;
    private final RefundRecordMapper refundMapper;

    @GetMapping("/page")
    public ApiResponse<IPage<TradeOrder>> getOrderPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long buyerId,
            @RequestParam(required = false) Long sellerId,
            @RequestParam(required = false) String orderStatus) {
        Page<TradeOrder> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getDelFlag, 0);
        if (buyerId != null) wrapper.eq(TradeOrder::getBuyerId, buyerId);
        if (sellerId != null) wrapper.eq(TradeOrder::getSellerId, sellerId);
        if (orderStatus != null) wrapper.eq(TradeOrder::getOrderStatus, orderStatus);
        wrapper.orderByDesc(TradeOrder::getCreateTime);
        return ApiResponse.success(orderMapper.selectPage(page, wrapper));
    }

    @GetMapping("/{id}")
    public ApiResponse<TradeOrder> getOrderById(@PathVariable Long id) {
        TradeOrder order = orderMapper.selectById(id);
        if (order == null) return ApiResponse.error("订单不存在");
        return ApiResponse.success(order);
    }

    @GetMapping("/{id}/items")
    public ApiResponse<List<OrderItem>> getOrderItems(@PathVariable Long id) {
        LambdaQueryWrapper<OrderItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(OrderItem::getOrderId, id);
        wrapper.eq(OrderItem::getDelFlag, 0);
        return ApiResponse.success(itemMapper.selectList(wrapper));
    }

    @PostMapping
    public ApiResponse<Boolean> createOrder(@RequestBody TradeOrder order) {
        order.setOrderNo("SO" + System.currentTimeMillis());
        order.setDelFlag(0);
        order.setOrderStatus("pending_confirm");
        order.setPaymentStatus("unpaid");
        order.setCreateTime(new Date());
        order.setUpdateTime(new Date());
        
        int result = orderMapper.insert(order);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> updateOrder(@PathVariable Long id, @RequestBody TradeOrder order) {
        order.setId(id);
        order.setUpdateTime(new Date());
        int result = orderMapper.updateById(order);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("更新失败");
    }

    @PostMapping("/{id}/status")
    public ApiResponse<Boolean> updateOrderStatus(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        TradeOrder order = orderMapper.selectById(id);
        if (order == null) return ApiResponse.error("订单不存在");
        
        String status = params.get("status");
        order.setOrderStatus(status);
        order.setUpdateTime(new Date());
        
        if ("paid".equals(status)) {
            order.setPaymentStatus("paid");
            order.setPaidAmount(order.getTotalAmount());
        } else if ("shipped".equals(status)) {
            order.setLogisticsStatus("picked");
        } else if ("received".equals(status)) {
            order.setBuyerConfirmed(1);
            order.setBuyerConfirmTime(new Date());
        } else if ("completed".equals(status)) {
            order.setSettleStatus("settled");
            order.setSettleTime(new Date());
        }
        
        int result = orderMapper.updateById(order);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("更新状态失败");
    }

    @PostMapping("/{id}/pay")
    public ApiResponse<Boolean> payOrder(@PathVariable Long id, @RequestBody java.util.Map<String, Object> params) {
        TradeOrder order = orderMapper.selectById(id);
        if (order == null) return ApiResponse.error("订单不存在");

        PaymentRecord payment = new PaymentRecord();
        payment.setPaymentNo("PY" + System.currentTimeMillis());
        payment.setOrderId(id);
        payment.setOrderNo(order.getOrderNo());
        payment.setPayerId(order.getBuyerId());
        payment.setPayerName(order.getBuyerName());
        payment.setAmount(order.getTotalAmount());
        payment.setActualAmount(order.getTotalAmount());
        payment.setPaymentMethod((String) params.get("paymentMethod"));
        payment.setPaymentStatus("success");
        payment.setTransactionId("TX" + UUID.randomUUID().toString().substring(0, 20));
        payment.setIdempotentKey("IDEMP-" + System.currentTimeMillis());
        payment.setPaymentTime(new Date());
        payment.setDelFlag(0);
        payment.setCreateTime(new Date());

        int result = paymentMapper.insert(payment);
        if (result > 0) {
            order.setPaymentStatus("paid");
            order.setPaidAmount(order.getTotalAmount());
            order.setOrderStatus("paid");
            order.setUpdateTime(new Date());
            orderMapper.updateById(order);
            return ApiResponse.success(true);
        }
        return ApiResponse.error("支付失败");
    }

    @PostMapping("/{id}/refund")
    public ApiResponse<Boolean> applyRefund(@PathVariable Long id, @RequestBody java.util.Map<String, Object> params) {
        TradeOrder order = orderMapper.selectById(id);
        if (order == null) return ApiResponse.error("订单不存在");

        RefundRecord refund = new RefundRecord();
        refund.setRefundNo("RF" + System.currentTimeMillis());
        refund.setOrderId(id);
        refund.setOrderNo(order.getOrderNo());
        refund.setRefundType((String) params.get("refundType"));
        refund.setRefundAmount(new BigDecimal(params.get("refundAmount").toString()));
        refund.setRefundReason((String) params.get("refundReason"));
        refund.setApplicantType((String) params.get("applicantType"));
        refund.setApplicantId(order.getBuyerId());
        refund.setApplicantName(order.getBuyerName());
        refund.setRefundStatus("pending");
        refund.setDelFlag(0);
        refund.setCreateTime(new Date());

        int result = refundMapper.insert(refund);
        if (result > 0) {
            order.setOrderStatus("refunding");
            order.setUpdateTime(new Date());
            orderMapper.updateById(order);
            return ApiResponse.success(true);
        }
        return ApiResponse.error("申请失败");
    }

    @PostMapping("/refund/{id}/audit")
    public ApiResponse<Boolean> auditRefund(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        RefundRecord refund = refundMapper.selectById(id);
        if (refund == null) return ApiResponse.error("退款记录不存在");

        refund.setRefundStatus(params.get("status"));
        refund.setReviewer(params.get("reviewer"));
        refund.setReviewTime(new Date());
        refund.setReviewRemark(params.get("remark"));
        refund.setUpdateTime(new Date());

        int result = refundMapper.updateById(refund);
        if (result > 0 && "approved".equals(params.get("status"))) {
            TradeOrder order = orderMapper.selectById(refund.getOrderId());
            if (order != null) {
                order.setRefundAmount(order.getRefundAmount().add(refund.getRefundAmount()));
                order.setPaymentStatus("refunded");
                order.setOrderStatus("refunded");
                order.setUpdateTime(new Date());
                orderMapper.updateById(order);
            }
            return ApiResponse.success(true);
        }
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("审核失败");
    }
}