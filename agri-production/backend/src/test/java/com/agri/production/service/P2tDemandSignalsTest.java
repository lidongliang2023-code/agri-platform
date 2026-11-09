package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class P2tDemandSignalsTest {
    private final P2tOfferMapper offers = mock(P2tOfferMapper.class);
    private final P2tSubscriptionMapper events = mock(P2tSubscriptionMapper.class);
    private P2tService service;
    @BeforeEach void setup() {
        service = new P2tService(mock(P2tVarietyMapMapper.class), offers, events,
                mock(P2tDiffTicketMapper.class), mock(HarvestBatchMapper.class), mock(InventoryMapper.class));
    }
    private P2tOffer offer(String no, String unit, String status, String audit) {
        P2tOffer o = new P2tOffer(); o.setTenantId("2001"); o.setOfferNo(no);
        o.setCategoryCode("fruit"); o.setUnit(unit); o.setTradeStatus(status); o.setAuditStatus(audit);
        o.setAvailableQty(new BigDecimal("100")); return o;
    }
    private P2tSubscription event(String no, String type, int qty) {
        P2tSubscription e = new P2tSubscription(); e.setTenantId("2001"); e.setOfferNo(no);
        e.setEventType(type); e.setQty(BigDecimal.valueOf(qty)); e.setWritebackStatus("SUCCESS"); return e;
    }
    private void data(List<P2tOffer> o, List<P2tSubscription> e) {
        when(offers.selectList(any())).thenReturn(o); when(events.selectList(any())).thenReturn(e);
    }
    private void number(Map<String,Object> row, String key, String expected) {
        assertEquals(0, new BigDecimal(expected).compareTo((BigDecimal)row.get(key)), key);
    }
    @Test void deductsCancellationAndReleaseButIgnoresFailedAndUnknownEvents() {
        P2tSubscription failed = event("A", "ORDER_PAID", 90); failed.setWritebackStatus("FAILED");
        data(List.of(offer("A", "kg", "LISTED", "APPROVED")), List.of(event("A", "ORDER_PAID", 80),
                event("A", "ORDER_CANCELLED", 10), event("A", "RELEASED", 20), failed, event("A", "SHORT_SHIPPED", 30)));
        Map<String,Object> r = service.demandSignals("2001").get(0);
        number(r,"paidQty","80"); number(r,"releasedQty","30"); number(r,"tradedQty","50");
        number(r,"subscriptionRate","50"); number(r,"onSaleQty","50");
    }
    @Test void unitsAreSeparateAndClosedHistoryRemains() {
        data(List.of(offer("A", "kg", "CLOSED", "APPROVED"), offer("B", "箱", "LISTED", "APPROVED")),
                List.of(event("A", "ORDER_PAID", 70)));
        List<Map<String,Object>> rows = service.demandSignals("2001"); assertEquals(2,rows.size());
        Map<String,Object> kg = rows.stream().filter(r -> "kg".equals(r.get("unit"))).findFirst().orElseThrow();
        number(kg,"tradedQty","70"); number(kg,"onSaleQty","0"); number(kg,"supplyQty","100");
    }
    @Test void pendingAndRejectedWithoutTradesDoNotInflateSupply() {
        data(List.of(offer("A","kg","PENDING","PENDING"), offer("B","kg","PENDING","REJECTED"),
                offer("C","kg","LISTED","APPROVED")),List.of());
        Map<String,Object> r=service.demandSignals("2001").get(0);
        assertEquals(1,r.get("offerCount")); number(r,"supplyQty","100"); assertEquals("暂无认购",r.get("judgement"));
    }
    @Test void excessReversalCannotOffsetOtherOffersAndIsFlagged() {
        data(List.of(offer("A","kg","LISTED","APPROVED"), offer("B","kg","LISTED","APPROVED")),
                List.of(event("A","ORDER_PAID",20),event("A","RELEASED",30),event("B","ORDER_PAID",50)));
        Map<String,Object> r=service.demandSignals("2001").get(0);
        number(r,"tradedQty","50"); assertEquals(true,r.get("dataAnomaly")); assertEquals("数据待核查",r.get("judgement"));
    }
    @Test void missingUnitAndOversubscriptionAreFlagged() {
        data(List.of(offer("A",null,"SOLD","APPROVED")), List.of(event("A","ORDER_PAID",120)));
        Map<String,Object> r=service.demandSignals("2001").get(0);
        assertEquals("未标注",r.get("unit")); assertEquals("数据待核查",r.get("judgement"));
    }
    @Test void subjectIsRequiredAndForeignRecordsAreExcluded() {
        assertThrows(BusinessException.class,()->service.demandSignals(null)); verifyNoInteractions(offers,events);
        P2tOffer foreign=offer("B","kg","LISTED","APPROVED"); foreign.setTenantId("2002");
        P2tSubscription foreignEvent=event("A","ORDER_PAID",100);foreignEvent.setTenantId("2002");
        data(List.of(offer("A","kg","LISTED","APPROVED"),foreign),List.of(foreignEvent));
        Map<String,Object> r=service.demandSignals("2001").get(0);
        assertEquals(1,r.get("offerCount"));number(r,"tradedQty","0");
    }
    private P2tSubscription dated(String type, int qty, String timestamp) {
        P2tSubscription e = event("A", type, qty);
        e.setCreateTime(java.time.LocalDateTime.parse(timestamp)); return e;
    }
    @Test void periodKeepsOpeningAndCrossPeriodCancellation() {
        data(List.of(offer("A","kg","LISTED","APPROVED")), List.of(
            dated("ORDER_PAID",80,"2026-09-30T12:00:00"),
            dated("ORDER_CANCELLED",20,"2026-10-15T12:00:00")));
        Map<String,Object> r=service.demandSignals("2001",java.time.LocalDate.parse("2026-10-01"),java.time.LocalDate.parse("2026-10-31")).get(0);
        number(r,"openingNetQty","80"); number(r,"periodPaidQty","0");
        number(r,"periodReleasedQty","20"); number(r,"periodNetQty","-20"); number(r,"tradedQty","60");
        assertEquals(false,r.get("dataAnomaly"));
    }
    @Test void endDayIncludedAndFollowingDayExcluded() {
        data(List.of(offer("A","kg","LISTED","APPROVED")), List.of(
            dated("ORDER_PAID",30,"2026-10-31T23:59:59"),dated("ORDER_PAID",40,"2026-11-01T00:00:00")));
        Map<String,Object> r=service.demandSignals("2001",java.time.LocalDate.parse("2026-10-01"),java.time.LocalDate.parse("2026-10-31")).get(0);
        number(r,"periodPaidQty","30"); number(r,"tradedQty","30");
    }
    @Test void invalidOrIncompleteRangeRejectedBeforeQuery() {
        java.time.LocalDate d=java.time.LocalDate.parse("2026-10-01");
        assertThrows(BusinessException.class,()->service.demandSignals("2001",d,null));
        assertThrows(BusinessException.class,()->service.demandSignals("2001",d,d.minusDays(1)));
        assertThrows(BusinessException.class,()->service.demandSignals("2001",d,java.time.LocalDate.now().plusDays(1)));
        verifyNoInteractions(offers,events);
    }
    @Test void missingTimestampCannotEnterPeriodSilently() {
        data(List.of(offer("A","kg","LISTED","APPROVED")),List.of(event("A","ORDER_PAID",30)));
        Map<String,Object> r=service.demandSignals("2001",java.time.LocalDate.parse("2026-10-01"),java.time.LocalDate.parse("2026-10-31")).get(0);
        number(r,"periodPaidQty","0"); assertEquals(true,r.get("dataAnomaly"));
    }
}
