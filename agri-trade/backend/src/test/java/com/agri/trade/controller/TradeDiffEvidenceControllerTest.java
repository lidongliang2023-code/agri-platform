package com.agri.trade.controller;
import com.agri.trade.entity.*;
import com.agri.trade.mapper.*;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.*;
import java.util.*;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class TradeDiffEvidenceControllerTest {
    final TradeOrderMapper orders = mock(TradeOrderMapper.class);
    final RefundRecordMapper refunds = mock(RefundRecordMapper.class);
    final PlatformIdentityService identity = mock(PlatformIdentityService.class);
    final LogisticsMapper logistics = mock(LogisticsMapper.class);
    final TradeDiffEvidenceController controller = new TradeDiffEvidenceController(orders,refunds,identity,logistics);
    @BeforeEach void setup() {
        var a = new MapperBuilderAssistant(new MybatisConfiguration(),"test");
        TableInfoHelper.initTableInfo(a,TradeOrder.class); TableInfoHelper.initTableInfo(a,RefundRecord.class); TableInfoHelper.initTableInfo(a,Logistics.class);
        when(identity.currentScope()).thenReturn(new PlatformIdentityService.MerchantScope(true,List.of(2001L),List.of(),null));
    }
    TradeOrder order() {
        var o = new TradeOrder(); o.setId(7L); o.setOrderNo("ORDER1"); o.setPaidAmount(new BigDecimal("100"));
        o.setRefundAmount(new BigDecimal("100")); o.setPaymentStatus("refunded"); o.setOrderStatus("refunded");
        when(orders.selectOne(any())).thenReturn(o); return o;
    }
    RefundRecord refund() {
        var f = new RefundRecord(); f.setRefundStatus("approved"); f.setRefundTime(new Date()); f.setFinishTime(new Date());
        f.setRefundAmount(new BigDecimal("100")); when(refunds.selectOne(any())).thenReturn(f); return f;
    }
    @Test void blocksForeignSubjectBeforeQuery() {
        assertEquals(403,controller.refund("O1","ORDER1","R1",2002L).getCode()); verifyNoInteractions(orders,refunds);
    }
    @Test void noOrderDoesNotQueryRefund() {
        assertEquals(404,controller.refund("O1","ORDER1","R1",2001L).getCode()); verifyNoInteractions(refunds);
    }
    @Test void pendingPartialAndMissingDatesCannotClose() {
        var o=order(); var f=refund(); f.setRefundStatus("pending"); assertFalse(verified());
        f.setRefundStatus("approved"); f.setRefundTime(null); assertFalse(verified());
        f.setRefundTime(new Date()); o.setRefundAmount(new BigDecimal("50")); assertFalse(verified());
    }
    @Test void verifiesOnlyMinimalLedgerResultWithScopedQueries() {
        order(); refund(); var response=controller.refund("O1","ORDER1","R1",2001L);
        assertEquals(true,response.getData().get("verified")); assertEquals(2,response.getData().size());
        var q=org.mockito.ArgumentCaptor.forClass(com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper.class);
        verify(orders).selectOne(q.capture()); String sql=q.getValue().getSqlSegment();
        assertTrue(sql.contains("seller_id")); assertTrue(sql.contains("source_offer_no")); assertTrue(sql.contains("order_no"));
        verify(refunds).selectOne(q.capture()); assertTrue(q.getValue().getSqlSegment().contains("order_id"));
    }
    boolean verified() {return Boolean.TRUE.equals(controller.refund("O1","ORDER1","R1",2001L).getData().get("verified"));}

    @Test void reshipRequiresExactQuantityUnitAndBuyerSignature() {
        var o = order(); o.setBuyerId(3001L);
        var row = new Logistics(); row.setOrderNo("ORDER1"); row.setReshipQty(new BigDecimal("10"));
        row.setReshipUnit("kg"); row.setLogisticsStatus("delivered"); row.setSignTime(new Date()); row.setSignedBuyerId(3001L);
        when(logistics.selectOne(any())).thenReturn(row);
        assertEquals(true, controller.reship("O1","ORDER1","D1","RS1",new BigDecimal("10"),"kg",2001L).getData().get("verified"));
        row.setReshipQty(new BigDecimal("9")); assertFalse(reshipVerified());
        row.setReshipQty(new BigDecimal("10")); row.setReshipUnit("斤"); assertFalse(reshipVerified());
        row.setReshipUnit("kg"); row.setSignedBuyerId(2001L); assertFalse(reshipVerified());
        row.setSignedBuyerId(3001L); row.setSignTime(null); assertFalse(reshipVerified());
        row.setSignTime(new Date()); row.setLogisticsStatus("in_transit"); assertFalse(reshipVerified());
        when(logistics.selectOne(any())).thenReturn(null); assertFalse(reshipVerified());
    }
    @Test void reshipBlocksForeignSubjectAndScopesTicketQuery() {
        assertEquals(403, controller.reship("O1","ORDER1","D1","RS1",BigDecimal.TEN,"kg",2002L).getCode());
        verifyNoInteractions(logistics,orders);
        order(); reshipVerified();
        var q=org.mockito.ArgumentCaptor.forClass(com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper.class);
        verify(logistics).selectOne(q.capture()); String sql=q.getValue().getSqlSegment();
        assertTrue(sql.contains("diff_ticket_no")); assertTrue(sql.contains("diff_subject_id")); assertTrue(sql.contains("order_id"));
    }
    boolean reshipVerified() { return Boolean.TRUE.equals(controller.reship("O1","ORDER1","D1","RS1",BigDecimal.TEN,"kg",2001L).getData().get("verified")); }
}
