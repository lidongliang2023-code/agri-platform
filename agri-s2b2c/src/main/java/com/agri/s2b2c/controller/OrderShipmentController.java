package com.agri.s2b2c.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.entity.Supplier;
import com.agri.s2b2c.mapper.OrderMapper;
import com.agri.s2b2c.service.ChannelIdentityService;
import com.agri.s2b2c.service.OrderShipmentService;
import com.agri.s2b2c.service.SupplierIdentityService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/** 供应商 / 渠道 订单发货协同接口。 */
@RestController
public class OrderShipmentController {

    private final OrderShipmentService shipmentService;
    private final OrderMapper orderMapper;
    private final SupplierIdentityService supplierIdentityService;
    private final ChannelIdentityService channelIdentityService;

    public OrderShipmentController(OrderShipmentService shipmentService, OrderMapper orderMapper,
                                   SupplierIdentityService supplierIdentityService,
                                   ChannelIdentityService channelIdentityService) {
        this.shipmentService = shipmentService;
        this.orderMapper = orderMapper;
        this.supplierIdentityService = supplierIdentityService;
        this.channelIdentityService = channelIdentityService;
    }

    /* ---------------- 供应商 ---------------- */

    @GetMapping("/api/supplier/order/{id}/shipment")
    @OperatorOnly("s2b2c:supplier")
    public ResponseEntity<Map<String, Object>> supplierLatest(@PathVariable Long id) {
        requireSupplierOrder(id);
        return ResponseEntity.ok(shipmentService.latest(id));
    }

    @PutMapping("/api/supplier/order/{id}/shipment/propose")
    @OperatorOnly("s2b2c:supplier")
    public ResponseEntity<Map<String, Object>> supplierPropose(@PathVariable Long id,
                                                               @RequestParam String logisticsNo,
                                                               @RequestParam(required = false) String company) {
        Supplier supplier = requireSupplierOrder(id);
        return ResponseEntity.ok(shipmentService.propose(id, "SUPPLIER", supplier.getId(), logisticsNo, company));
    }

    @PutMapping("/api/supplier/order/{id}/shipment/confirm")
    @OperatorOnly("s2b2c:supplier")
    public ResponseEntity<Map<String, Object>> supplierConfirm(@PathVariable Long id) {
        Supplier supplier = requireSupplierOrder(id);
        return ResponseEntity.ok(shipmentService.confirm(id, "SUPPLIER", supplier.getId()));
    }

    @PutMapping("/api/supplier/order/{id}/shipment/reject")
    @OperatorOnly("s2b2c:supplier")
    public ResponseEntity<Map<String, Object>> supplierReject(@PathVariable Long id,
                                                              @RequestParam String reason) {
        Supplier supplier = requireSupplierOrder(id);
        return ResponseEntity.ok(shipmentService.reject(id, "SUPPLIER", supplier.getId(), reason));
    }

    @PutMapping("/api/supplier/order/{id}/shipment/withdraw")
    @OperatorOnly("s2b2c:supplier")
    public ResponseEntity<Map<String, Object>> supplierWithdraw(@PathVariable Long id) {
        Supplier supplier = requireSupplierOrder(id);
        return ResponseEntity.ok(shipmentService.withdraw(id, "SUPPLIER", supplier.getId()));
    }

    /* ---------------- 渠道 ---------------- */

    @GetMapping("/api/channel/order/{id}/shipment")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> channelLatest(@PathVariable Long id) {
        requireChannelOrder(id);
        return ResponseEntity.ok(shipmentService.latest(id));
    }

    @PutMapping("/api/channel/order/{id}/shipment/propose")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> channelPropose(@PathVariable Long id,
                                                              @RequestParam String logisticsNo,
                                                              @RequestParam(required = false) String company) {
        ChannelPartner channel = requireChannelOrder(id);
        return ResponseEntity.ok(shipmentService.propose(id, "CHANNEL", channel.getId(), logisticsNo, company));
    }

    @PutMapping("/api/channel/order/{id}/shipment/confirm")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> channelConfirm(@PathVariable Long id) {
        ChannelPartner channel = requireChannelOrder(id);
        return ResponseEntity.ok(shipmentService.confirm(id, "CHANNEL", channel.getId()));
    }

    @PutMapping("/api/channel/order/{id}/shipment/reject")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> channelReject(@PathVariable Long id,
                                                             @RequestParam String reason) {
        ChannelPartner channel = requireChannelOrder(id);
        return ResponseEntity.ok(shipmentService.reject(id, "CHANNEL", channel.getId(), reason));
    }

    @PutMapping("/api/channel/order/{id}/shipment/withdraw")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> channelWithdraw(@PathVariable Long id) {
        ChannelPartner channel = requireChannelOrder(id);
        return ResponseEntity.ok(shipmentService.withdraw(id, "CHANNEL", channel.getId()));
    }

    private Supplier requireSupplierOrder(Long orderId) {
        Supplier mine = supplierIdentityService.requireCurrent();
        Order order = orderMapper.selectById(orderId);
        if (order == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在");
        if (order.getSupplierId() == null || !order.getSupplierId().equals(mine.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该订单不属于当前供应商");
        }
        return mine;
    }

    private ChannelPartner requireChannelOrder(Long orderId) {
        ChannelPartner mine = channelIdentityService.requireApprovedChannel(null);
        Order order = orderMapper.selectById(orderId);
        if (order == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在");
        if (order.getChannelId() == null || !order.getChannelId().equals(mine.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该订单不属于当前渠道");
        }
        return mine;
    }
}
