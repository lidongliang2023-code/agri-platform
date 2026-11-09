package com.agri.s2b2c.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.s2b2c.service.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
public class OrderTraceController {
    private final OrderTraceService traces;
    private final SupplierIdentityService supply;
    private final ConsumerIdentityService consumers;
    public OrderTraceController(OrderTraceService traces, SupplierIdentityService supply, ConsumerIdentityService consumers) {
        this.traces = traces; this.supply = supply; this.consumers = consumers;
    }
    public record BindRequest(List<String> codes) {}
    @PostMapping("/api/platform/supply/order/{orderId}/item/{itemId}/trace-units")
    @OperatorOnly("s2b2c:platform")
    public Map<String, Object> bind(@PathVariable Long orderId, @PathVariable Long itemId, @RequestBody BindRequest request) {
        return traces.bind(orderId, itemId, request.codes(), supply.requireCurrent().getId());
    }
    @GetMapping("/api/platform/supply/order/{orderId}/item/{itemId}/trace")
    @OperatorOnly("s2b2c:platform")
    public Map<String, Object> supplyTrace(@PathVariable Long orderId, @PathVariable Long itemId) {
        // 通过既有货源归属校验，避免跨档案读取。
        traces.requireSupplyOrder(orderId, supply.requireCurrent().getId());
        return traces.itemTrace(orderId, itemId);
    }
    @GetMapping("/api/consumer/order/{orderId}/item/{itemId}/trace")
    @OperatorOnly("s2b2c:consumer")
    public Map<String, Object> consumerTrace(@PathVariable Long orderId, @PathVariable Long itemId) {
        consumers.requireOwnOrder(orderId);
        return traces.itemTrace(orderId, itemId);
    }
}
