package com.agri.trade.controller;

import com.agri.trade.entity.*;
import com.agri.trade.mapper.*;
import com.agri.trade.service.PlatformIdentityService;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TradeTraceLogisticsControllerTest {
    final TradeOrderMapper orders = mock(TradeOrderMapper.class);
    final LogisticsMapper logistics = mock(LogisticsMapper.class);
    final LogisticsTraceMapper traces = mock(LogisticsTraceMapper.class);
    final PlatformIdentityService identity = mock(PlatformIdentityService.class);
    final TradeTraceLogisticsController controller = new TradeTraceLogisticsController(orders, logistics, traces, identity);
    void scope() { when(identity.currentScope()).thenReturn(new PlatformIdentityService.MerchantScope(true, List.of(2001L), List.of(), null)); }
    @Test void rejectsOtherSubjectBeforeQuery() {
        scope(); assertEquals(403, controller.getLogisticsByOffer("O1", 2002L).getCode());
        verifyNoInteractions(orders, logistics, traces);
    }
    @Test void identityFailureNeverReturnsUnfilteredOrders() {
        when(identity.currentScope()).thenReturn(new PlatformIdentityService.MerchantScope(false, List.of(), List.of(), "身份不可用"));
        assertEquals(401, controller.getLogisticsByOffer("O1", 2001L).getCode()); verifyNoInteractions(orders);
    }
    @Test void missingOrdersReturnsEmpty() {
        scope(); when(orders.selectList(any())).thenReturn(List.of());
        assertTrue(controller.getLogisticsByOffer("O1", 2001L).getData().isEmpty()); verifyNoInteractions(logistics, traces);
    }
    @Test void redactsFreeTextContactsAndDetailedAddress() {
        String loc = TradeTraceLogisticsController.redact("福建省漳州市芗城区建设路18号3栋 13812345678", true);
        assertFalse(loc.contains("13812345678")); assertFalse(loc.contains("建设路"));
        String locPure = TradeTraceLogisticsController.redact("建设路18号", true);
        assertEquals("位置详情已脱敏", locPure);
        String desc = TradeTraceLogisticsController.redact("司机张三 13812345678 已到达漳州转运站，邮箱a@b.com", false);
        assertFalse(desc.contains("13812345678")); assertFalse(desc.contains("a@b.com")); assertFalse(desc.contains("张三")); assertEquals("轨迹详情已脱敏，请查看节点状态与时间", desc);
        assertNull(TradeTraceLogisticsController.redact(null, true));
        assertNull(TradeTraceLogisticsController.redact("  ", false));
    }
    @Test void includesAllShipmentsWithoutFollowingOrderPointerOrExposingContacts() {
        scope(); TradeOrder order = new TradeOrder(); order.setId(7L); order.setLogisticsId(999L); order.setOrderNo("ORDER");
        order.setBuyerPhone("PRIVATE"); order.setSourceOfferNo("O1");
        Logistics first = new Logistics(); first.setId(10L); first.setOrderId(7L); first.setReceiverPhone("PRIVATE"); first.setCurrentLocation("PRIVATE");
        Logistics second = new Logistics(); second.setId(11L); second.setOrderId(7L);
        when(orders.selectList(any())).thenReturn(List.of(order)); when(logistics.selectList(any())).thenReturn(List.of(first, second));
        LogisticsTrace event = new LogisticsTrace(); event.setTraceLocation("PRIVATE"); event.setTraceDescription("PRIVATE");
        when(traces.selectList(any())).thenReturn(List.of(event));
        var data = controller.getLogisticsByOffer("O1",2001L).getData();
        assertEquals(2, ((List<?>)data.get(0).get("shipments")).size());
        assertFalse(data.toString().contains("PRIVATE")); verify(logistics,never()).selectById(any());
        verify(traces,times(2)).selectList(any());
    }
}
