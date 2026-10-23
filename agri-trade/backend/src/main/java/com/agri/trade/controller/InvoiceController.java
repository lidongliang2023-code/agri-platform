package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Invoice;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.InvoiceMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import java.util.Set;

/**
 * 买家开票申请（2026-10-20）。
 *
 * <p>交易域此前没有发票表/接口，买家中心只能写"未接入"。这里补最小闭环：
 * 已付款订单可申请一张发票，金额取订单总额（不采信前端），一笔订单只允许一张申请；
 * 开票状态由运营/财务推进（issued/rejected），本接口只负责申请与查询。</p>
 */
@RestController
@RequestMapping("/api/trade/invoice")
@RequiredArgsConstructor
public class InvoiceController {

    private static final Set<String> INVOICEABLE_ORDER_STATUS = Set.of("paid", "shipped", "received", "completed");
    private static final Set<String> ALLOWED_TYPES = Set.of("增值税专用发票", "增值税普通发票", "电子普通发票");

    private final InvoiceMapper invoiceMapper;
    private final TradeOrderMapper orderMapper;
    private final PlatformIdentityService identityService;

    /** 我的开票申请（购买方范围由服务端推导）。 */
    @GetMapping("/mine")
    public ApiResponse<List<Invoice>> mine() {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        if (!scope.hasBinding()) {
            return ApiResponse.success(List.of());
        }
        return ApiResponse.success(invoiceMapper.selectList(new LambdaQueryWrapper<Invoice>()
                .eq(Invoice::getDelFlag, 0)
                .in(Invoice::getBuyerId, scope.merchantIds())
                .orderByDesc(Invoice::getApplyTime)));
    }

    /** 申请开票。 */
    @PostMapping
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Invoice> apply(@RequestBody ApplyRequest request) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        if (request == null || request.getOrderId() == null) {
            return ApiResponse.error("请选择要开票的订单");
        }
        TradeOrder order = orderMapper.selectById(request.getOrderId());
        if (order == null || Integer.valueOf(1).equals(order.getDelFlag())) {
            return ApiResponse.error("订单不存在");
        }
        if (order.getBuyerId() == null || !scope.merchantIds().contains(order.getBuyerId())) {
            return ApiResponse.error("只能对自己的采购订单申请开票");
        }
        if (!INVOICEABLE_ORDER_STATUS.contains(order.getOrderStatus())) {
            return ApiResponse.error("订单尚未付款或已取消，暂不能开票");
        }
        Long exists = invoiceMapper.selectCount(new LambdaQueryWrapper<Invoice>()
                .eq(Invoice::getOrderId, order.getId())
                .eq(Invoice::getDelFlag, 0));
        if (exists != null && exists > 0) {
            return ApiResponse.error("该订单已提交过开票申请");
        }
        String type = request.getInvoiceType() == null ? "" : request.getInvoiceType().trim();
        if (!ALLOWED_TYPES.contains(type)) {
            return ApiResponse.error("请选择正确的发票类型");
        }
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            return ApiResponse.error("请填写发票抬头");
        }
        Date now = new Date();
        Invoice invoice = new Invoice();
        invoice.setInvoiceNo("INV" + System.currentTimeMillis());
        invoice.setOrderId(order.getId());
        invoice.setOrderNo(order.getOrderNo());
        invoice.setBuyerId(order.getBuyerId());
        invoice.setBuyerName(order.getBuyerName());
        invoice.setSellerId(order.getSellerId());
        invoice.setSellerName(order.getSellerName());
        invoice.setAmount(order.getTotalAmount() == null ? BigDecimal.ZERO : order.getTotalAmount());
        invoice.setInvoiceType(type);
        invoice.setTitle(request.getTitle().trim());
        invoice.setTaxNo(request.getTaxNo() == null ? null : request.getTaxNo().trim());
        invoice.setInvoiceStatus("pending");
        invoice.setApplyTime(now);
        invoice.setRemark(request.getRemark());
        invoice.setDelFlag(0);
        invoice.setCreateTime(now);
        invoice.setUpdateTime(now);
        invoiceMapper.insert(invoice);
        return ApiResponse.success(invoice);
    }

    @Data
    public static class ApplyRequest {
        private Long orderId;
        private String invoiceType;
        private String title;
        private String taxNo;
        private String remark;
    }
}
