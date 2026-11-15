package com.agri.trade.controller;
import com.agri.trade.entity.*;
import com.agri.trade.mapper.*;
import com.agri.trade.service.PlatformIdentityService;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.math.BigDecimal;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class ProcessingOrderControllerTest {
    final TradeOrderMapper orders=mock(TradeOrderMapper.class);
    final OrderItemMapper items=mock(OrderItemMapper.class);
    final PlatformIdentityService identity=mock(PlatformIdentityService.class);
    final ProcessingOrderController controller=new ProcessingOrderController(orders,items,identity);
    void allowed(){when(identity.selectMerchant(2001L)).thenReturn(new PlatformIdentityService.MerchantSelection(2001L,"测试主体","owner",null));}
    @Test void unauthorizedSubjectNeverQueriesOrders(){when(identity.selectMerchant(2002L)).thenReturn(new PlatformIdentityService.MerchantSelection(null,null,null,"无权"));assertEquals(403,controller.list(2002L).getCode());verifyNoInteractions(orders,items);}
    @Test void buyerCannotReadSellerProjection(){allowed();TradeOrder order=new TradeOrder();order.setId(1L);order.setBuyerId(2001L);order.setSellerId(2002L);when(orders.selectById(1L)).thenReturn(order);assertEquals(404,controller.detail(2001L,1L).getCode());verifyNoInteractions(items);}
    @Test void sellerProjectionKeepsUnitsAndDeadlineButNoBuyerContacts(){allowed();TradeOrder order=new TradeOrder();order.setId(1L);order.setSellerId(2001L);order.setBuyerPhone("PRIVATE");order.setBuyerName("PRIVATE");order.setOrderNo("SO-TEST");order.setDeliveryDeadline(new Date(1800000000000L));OrderItem item=new OrderItem();item.setId(3L);item.setQuantity(BigDecimal.TEN);item.setUnit("吨");when(orders.selectById(1L)).thenReturn(order);when(items.selectList(any())).thenReturn(List.of(item));var response=controller.detail(2001L,1L);assertEquals(200,response.getCode());assertFalse(response.getData().toString().contains("PRIVATE"));Map<?,?> data=(Map<?,?>)response.getData();assertTrue(data.get("deliveryDeadline").toString().contains("T"));assertEquals("吨",((Map<?,?>)((List<?>)data.get("items")).get(0)).get("unit"));}
    @Test void listIsScopedToSeller(){allowed();when(orders.selectList(any())).thenReturn(List.of());assertEquals(200,controller.list(2001L).getCode());verifyNoInteractions(items);}
}
