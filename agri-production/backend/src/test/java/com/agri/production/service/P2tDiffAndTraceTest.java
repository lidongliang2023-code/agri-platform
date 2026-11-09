package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.P2tDiffTicket;
import com.agri.production.entity.P2tOffer;
import com.agri.production.entity.P2tSubscription;
import com.agri.production.mapper.*;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class P2tDiffAndTraceTest {
    private final P2tVarietyMapMapper varietyMapper = mock(P2tVarietyMapMapper.class);
    private final P2tOfferMapper offerMapper = mock(P2tOfferMapper.class);
    private final P2tSubscriptionMapper subscriptionMapper = mock(P2tSubscriptionMapper.class);
    private final P2tDiffTicketMapper diffMapper = mock(P2tDiffTicketMapper.class);
    private final HarvestBatchMapper harvestBatchMapper = mock(HarvestBatchMapper.class);
    private final InventoryMapper inventoryMapper = mock(InventoryMapper.class);
    private P2tService service;

    @BeforeEach
    void setUp() {
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "test");
        TableInfoHelper.initTableInfo(assistant, P2tDiffTicket.class);
        TableInfoHelper.initTableInfo(assistant, P2tOffer.class);
        TableInfoHelper.initTableInfo(assistant, HarvestBatch.class);
        TableInfoHelper.initTableInfo(assistant, P2tSubscription.class);
        service = new P2tService(varietyMapper, offerMapper, subscriptionMapper, diffMapper, harvestBatchMapper, inventoryMapper);
    }

    @Test
    void pageDiffsFiltersStatusTypeAndKeyword() {
        when(diffMapper.selectPage(any(Page.class), any())).thenAnswer(inv -> {
            Page<P2tDiffTicket> page = inv.getArgument(0);
            page.setRecords(List.of());
            page.setTotal(0);
            return page;
        });
        PageResult<P2tDiffTicket> result = service.pageDiffs(1, 10, "PROCESSING", "SHORT_SHIP", "DIFF-001", "2001");
        assertNotNull(result);
        ArgumentCaptor<LambdaQueryWrapper<P2tDiffTicket>> captor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(diffMapper).selectPage(any(Page.class), captor.capture());
        String sql = captor.getValue().getSqlSegment();
        assertTrue(sql.contains("status ="));
        assertTrue(sql.contains("diff_type ="));
        assertTrue(sql.contains("tenant_id ="));
    }

    @Test
    void handleDiffRejectsClosedTicketAndInvalidStatus() {
        P2tDiffTicket closed = new P2tDiffTicket();
        closed.setId(10L);
        closed.setTenantId("2001");
        closed.setStatus("CLOSED");
        when(diffMapper.selectById(10L)).thenReturn(closed);
        assertThrows(BusinessException.class, () -> service.handleDiff(10L, "PROCESSING", "补发", "说明", "2001"));
        assertThrows(BusinessException.class, () -> service.handleDiff(10L, "INVALID", "补发", "说明", "2001"));
    }

    @Test
    void traceCanExcludeSubscriptionsWhenRequested() {
        HarvestBatch batch = new HarvestBatch();
        batch.setBatchNo("H202601");
        batch.setTenantId("2001");
        when(harvestBatchMapper.selectOne(any())).thenReturn(batch);
        P2tOffer offer = new P2tOffer();
        offer.setOfferNo("OFF-001");
        offer.setBatchNo("H202601");
        offer.setTenantId("2001");
        when(offerMapper.selectList(any())).thenReturn(List.of(offer));

        Map<String, Object> full = service.traceByBatch("H202601", "2001", true);
        assertTrue(full.containsKey("subscriptions"));
        verify(subscriptionMapper, atLeastOnce()).selectList(any());

        clearInvocations(subscriptionMapper);
        Map<String, Object> light = service.traceByBatch("H202601", "2001", false);
        assertFalse(light.containsKey("subscriptions"));
        verifyNoInteractions(subscriptionMapper);
    }

    P2tDiffTicket ticket(String state, String owner) {
        P2tDiffTicket t = new P2tDiffTicket(); t.setId(10L); t.setTenantId("2001");
        t.setStatus(state); t.setOwnerSide(owner); t.setOfferNo("O1"); t.setOrderNo("ORDER1");
        when(diffMapper.selectOne(any())).thenReturn(t); when(diffMapper.updateById(any(P2tDiffTicket.class))).thenReturn(1);
        return t;
    }
    @Test void cannotCloseBeforeProcessingOrWithUnsupportedEvidence() {
        ticket("PENDING", "PRODUCTION");
        assertThrows(BusinessException.class, () -> service.handleDiff(10L,"CLOSED","退款","已办理","R1","PENDING","2001"));
        ticket("PROCESSING", "PRODUCTION");
        assertThrows(BusinessException.class, () -> service.handleDiff(10L,"CLOSED","补发","已办理","L1","PROCESSING","2001"));
        verify(diffMapper, never()).updateById(any(P2tDiffTicket.class));
    }
    @Test void rejectsOtherOwnerStaleStatusAndPlatformChannel() {
        ticket("PROCESSING", "TRADE");
        assertThrows(BusinessException.class, () -> service.handleDiff(10L,"PROCESSING","退款","处理中",null,"PROCESSING","2001"));
        ticket("PROCESSING", "PRODUCTION");
        assertThrows(BusinessException.class, () -> service.handleDiff(10L,"PROCESSING","退款","处理中",null,"PENDING","2001"));
        assertThrows(BusinessException.class, () -> service.handleDiff(10L,"PROCESSING","退款","处理中",null,"PROCESSING",null));
        verify(diffMapper, never()).updateById(any(P2tDiffTicket.class));
    }
    @Test void appendsHistoryWithoutOverwritingAndRejectsOverflow() {
        P2tDiffTicket t = ticket("PENDING", "PRODUCTION"); t.setHandleRemark("已有记录");
        var saved = service.handleDiff(10L,"PROCESSING","退款","申请中",null,"PENDING","2001");
        assertTrue(saved.getHandleRemark().startsWith("已有记录\n"));
        assertTrue(saved.getHandleRemark().contains("申请中"));
        t.setHandleRemark("旧".repeat(490)); clearInvocations(diffMapper);
        assertThrows(BusinessException.class, () -> service.handleDiff(10L,"PROCESSING","退款","申请中",null,"PROCESSING","2001"));
        verify(diffMapper, never()).updateById(any(P2tDiffTicket.class));
    }
    @Test void closesOnlyAfterTradeEvidenceAndKeepsTicketOnFailure() {
        var client = mock(com.agri.production.integration.TradeLogisticsClient.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service,"diffEvidenceClient",client);
        ticket("PROCESSING", "PRODUCTION");
        P2tOffer offer = new P2tOffer(); offer.setTenantId("2001"); when(offerMapper.selectOne(any())).thenReturn(offer);
        doThrow(new BusinessException(503,"不可用")).when(client).verifyDiffRefund("O1","ORDER1","R1","2001");
        assertThrows(BusinessException.class, () -> service.handleDiff(10L,"CLOSED","退款","已记账","R1","PROCESSING","2001"));
        verify(diffMapper, never()).updateById(any(P2tDiffTicket.class));
        reset(client);
        var saved = service.handleDiff(10L,"CLOSED","退款","已记账","R1","PROCESSING","2001");
        assertEquals("CLOSED",saved.getStatus()); assertTrue(saved.getHandleRemark().contains("R1"));
        verify(client).verifyDiffRefund("O1","ORDER1","R1","2001");
    }

    @Test void reshipClosureRequiresShortShipAndTradeEvidence() {
        var client = mock(com.agri.production.integration.TradeLogisticsClient.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service,"diffEvidenceClient",client);
        var t=ticket("PROCESSING","PRODUCTION"); t.setTicketNo("D1"); t.setDiffType("SHORT_SHIP"); t.setDiffQty(java.math.BigDecimal.TEN);
        var offer=new P2tOffer(); offer.setUnit("kg"); when(offerMapper.selectOne(any())).thenReturn(offer);
        doThrow(new BusinessException(400,"未签收")).when(client).verifyDiffReship("O1","ORDER1","D1","RS1",java.math.BigDecimal.TEN,"kg","2001");
        assertThrows(BusinessException.class,()->service.handleDiff(10L,"CLOSED","补发","已补齐","RS1","PROCESSING","2001"));
        assertEquals("PROCESSING",t.getStatus()); verify(diffMapper,never()).updateById(any(P2tDiffTicket.class));
        reset(client); var saved=service.handleDiff(10L,"CLOSED","补发","已补齐","RS1","PROCESSING","2001");
        assertEquals("CLOSED",saved.getStatus()); assertTrue(saved.getHandleRemark().contains("RS1"));
        verify(client).verifyDiffReship("O1","ORDER1","D1","RS1",java.math.BigDecimal.TEN,"kg","2001");
    }
    @Test void reshipRequirementRejectsUnreadyAndReturnsAuthoritativeQuantity() {
        var t=ticket("PROCESSING","PRODUCTION"); t.setTicketNo("D1"); t.setDiffType("SHORT_SHIP"); t.setDiffQty(java.math.BigDecimal.TEN); t.setHandleWay("补发");
        var offer=new P2tOffer(); offer.setUnit("kg"); when(offerMapper.selectOne(any())).thenReturn(offer);
        var result=service.reshipRequirement("D1","2001"); assertEquals(java.math.BigDecimal.TEN,result.get("quantity")); assertEquals("kg",result.get("unit"));
        t.setStatus("CLOSED"); assertThrows(BusinessException.class,()->service.reshipRequirement("D1","2001"));
        t.setStatus("PROCESSING"); t.setDiffType("GRADE_DOWN"); assertThrows(BusinessException.class,()->service.reshipRequirement("D1","2001"));
    }
}
