package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.entity.OrderItem;
import com.agri.s2b2c.integration.ProductionTraceClient;
import com.agri.s2b2c.mapper.OrderItemMapper;
import com.agri.s2b2c.mapper.OrderMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OrderTraceServiceTest {
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    OrderMapper orders = mock(OrderMapper.class);
    OrderItemMapper items = mock(OrderItemMapper.class);
    ProductionTraceClient production = mock(ProductionTraceClient.class);
    OrderTraceService service = new OrderTraceService(jdbc, orders, items, production, mock(ProductionTraceQueryService.class));
    Order order;
    OrderItem item;
    @BeforeEach void setup() {
        order = new Order(); order.setId(1L); order.setSupplierId(7L); order.setStatus("PENDING_SHIP");
        item = new OrderItem(); item.setId(2L); item.setOrderId(1L); item.setProdBatchNo("B001"); item.setQuantity(2);
        when(orders.selectById(1L)).thenReturn(order); when(items.selectById(2L)).thenReturn(item);
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq(2L))).thenReturn(0L);
    }
    @Test void rejectsOtherSourceBeforeProductionQuery() {
        assertEquals(403, assertThrows(ResponseStatusException.class, () -> service.bind(1L,2L,List.of("A","B"),8L)).getStatusCode().value());
        verifyNoInteractions(production);
    }
    @Test void rejectsMissingHistoricalBatch() {
        item.setProdBatchNo(null);
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.bind(1L,2L,List.of("A","B"),7L)).getStatusCode().value());
        verifyNoInteractions(production);
    }
    @Test void rejectsCountAndDuplicateCodes() {
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.bind(1L,2L,List.of("A"),7L)).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.bind(1L,2L,List.of("A","A"),7L)).getStatusCode().value());
        verifyNoInteractions(production);
    }
    @Test void rejectsOverwritingExistingBinding() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq(2L))).thenReturn(2L);
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.bind(1L,2L,List.of("A","B"),7L)).getStatusCode().value());
        verifyNoInteractions(production);
    }
    @Test void bindsValidUnitsFromSameBatch() {
        when(production.codeTrace(anyString(), isNull())).thenReturn(java.util.Map.of("verifiable", true, "batchNo", "B001"));
        assertEquals(2, service.bind(1L, 2L, List.of("A", "B"), 7L).get("count"));
        verify(jdbc, times(2)).update(anyString(), any(Object[].class));
    }
    @Test void rejectsInvalidUnitAndWrongBatch() {
        when(production.codeTrace(anyString(), isNull())).thenReturn(java.util.Map.of("verifiable", false));
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.bind(1L,2L,List.of("A","B"),7L)).getStatusCode().value());
        when(production.codeTrace(anyString(), isNull())).thenReturn(java.util.Map.of("verifiable", true, "batchNo", "OTHER"));
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.bind(1L,2L,List.of("A","B"),7L)).getStatusCode().value());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }
    @Test void rejectsShippingWithoutAllUnits() {
        when(items.selectList(any())).thenReturn(List.of(item));
        when(jdbc.queryForList(anyString(), eq(String.class), eq(2L))).thenReturn(List.of("A"));
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.requireShippable(1L)).getStatusCode().value());
    }
    @Test void rejectsItemFromOtherOrder() {
        item.setOrderId(3L);
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> service.requireItem(1L,2L)).getStatusCode().value());
    }
}
