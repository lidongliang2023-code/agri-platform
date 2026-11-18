package com.agri.trade.controller;

import com.agri.trade.entity.*;
import com.agri.trade.mapper.*;
import com.agri.trade.service.*;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

class TradeMobileIntegrationTest {
    final TradeOrderMapper orders = mock(TradeOrderMapper.class);
    final OrderItemMapper items = mock(OrderItemMapper.class);
    final RefundRecordMapper refunds = mock(RefundRecordMapper.class);
    final TradeProductMapper products = mock(TradeProductMapper.class);
    final ProductSkuMapper skus = mock(ProductSkuMapper.class);
    final ContractMapper contracts = mock(ContractMapper.class);
    final InvoiceMapper invoices = mock(InvoiceMapper.class);
    final PlatformIdentityService identity = mock(PlatformIdentityService.class);
    final OrderController orderController = new OrderController(orders, items, mock(PaymentRecordMapper.class), refunds,
        mock(LogisticsMapper.class), mock(LogisticsTraceMapper.class), products, skus, identity,
        mock(IContractService.class), mock(P2tTradeService.class));
    @BeforeEach void setup() {
        var assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "mobile-test");
        for (Class<?> type : List.of(TradeOrder.class, RefundRecord.class, TradeProduct.class, ProductSku.class, Contract.class, Invoice.class))
            TableInfoHelper.initTableInfo(assistant, type);
        when(identity.currentScope()).thenReturn(new PlatformIdentityService.MerchantScope(true, List.of(2001L, 2002L), List.of(), null));
        when(identity.selectMerchant(null)).thenReturn(new PlatformIdentityService.MerchantSelection(null, null, null, "请选择经营主体"));
    }
    Map<String,Object> purchase() {
        var product = new TradeProduct(); product.setId(9L); product.setPublishStatus("published");
        product.setPrice(BigDecimal.TEN); product.setStockQuantity(BigDecimal.TEN); product.setMinOrderQuantity(BigDecimal.ONE);
        when(products.selectById(9L)).thenReturn(product); when(skus.selectList(any())).thenReturn(List.of());
        return new HashMap<>(Map.of("productId", 9L, "quantity", 1, "buyerId", "2002"));
    }
    @Test void directPurchaseUsesExplicitBoundBuyerBeforeStockUpdate() {
        var body = purchase();
        when(identity.selectMerchant(2002L)).thenReturn(new PlatformIdentityService.MerchantSelection(2002L, "采购主体B", "owner", null));
        orderController.createOrderFromProduct(body);
        verify(identity).selectMerchant(2002L);
        verify(products).update(isNull(), any());
    }
    @Test void foreignBuyerCannotDeductStockOrCreateOrder() {
        var body = purchase(); body.put("buyerId", 999L);
        when(identity.selectMerchant(999L)).thenReturn(new PlatformIdentityService.MerchantSelection(null, null, null, "无权使用该主体"));
        assertNotEquals(200, orderController.createOrderFromProduct(body).getCode());
        verify(identity).selectMerchant(999L); verify(products, never()).update(isNull(), any()); verifyNoInteractions(orders, items);
    }
    @Test void standaloneQuoteUsesExplicitSeller() {
        var service = mock(IQuoteService.class);
        var controller = new NegotiationController(mock(IInquiryService.class), service, identity);
        when(identity.selectMerchant(2002L)).thenReturn(new PlatformIdentityService.MerchantSelection(2002L, "供货主体B", "owner", null));
        controller.createQuote(Map.of("sellerId", "2002", "productName", "测试商品", "unitPrice", "10", "quantity", "2"));
        verify(identity).selectMerchant(2002L);
        verify(service).createQuoteFromForm(any(), eq(2002L), eq("供货主体B"), any());
    }
    @Test void awaitingPaymentIncludesBothUnpaidOrderStates() {
        orderController.getOrderPage(1, 20, "awaiting_payment", null, null, "buyer");
        var capture = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(orders).selectPage(any(), capture.capture());
        var query = capture.getValue(); String sql = query.getSqlSegment();
        assertTrue(sql.contains("buyer_id") && sql.contains("order_status IN"), sql);
        assertTrue(query.getParamNameValuePairs().containsValue("pending"));
        assertTrue(query.getParamNameValuePairs().containsValue("pending_confirm"));
    }
    @Test void contractListHonorsOrderFilterInsideParticipantScope() throws Exception {
        var controller = new ContractController(contracts, mock(ContractTemplateMapper.class), identity);
        MockMvcBuilders.standaloneSetup(controller).build().perform(get("/api/trade/contract/page").param("orderId", "77"));
        var capture = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(contracts).selectPage(any(), capture.capture());
        String sql = capture.getValue().getSqlSegment();
        assertTrue(sql.contains("order_id =") && sql.contains("buyer_id") && sql.contains("seller_id"), sql);
        assertTrue(capture.getValue().getParamNameValuePairs().containsValue(77L));
    }
    @Test void sellerInvoiceQueryUsesSellerScope() throws Exception {
        var controller = new InvoiceController(invoices, orders, identity);
        MockMvcBuilders.standaloneSetup(controller).build().perform(get("/api/trade/invoice/mine").param("side", "seller"));
        var capture = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(invoices).selectList(capture.capture());
        String sql = capture.getValue().getSqlSegment();
        assertTrue(sql.contains("seller_id IN"), sql); assertFalse(sql.contains("buyer_id IN"), sql);
    }
    @Test void sellerRefundQueryIncludesSalesOrders() throws Exception {
        when(orders.selectList(any())).thenReturn(List.of());
        MockMvcBuilders.standaloneSetup(orderController).build().perform(get("/api/trade/order/refund/mine").param("side", "seller"));
        var capture = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(orders).selectList(capture.capture());
        String sql = capture.getValue().getSqlSegment();
        assertTrue(sql.contains("seller_id IN"), sql);
    }
}
