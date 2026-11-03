package com.agri.s2b2c.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.entity.Supplier;
import com.agri.s2b2c.service.ChannelIdentityService;
import com.agri.s2b2c.service.NoticeService;
import com.agri.s2b2c.service.SupplierIdentityService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 供应商 / 渠道站内通知。 */
@RestController
public class NoticeController {

    private final NoticeService noticeService;
    private final SupplierIdentityService supplierIdentityService;
    private final ChannelIdentityService channelIdentityService;

    public NoticeController(NoticeService noticeService, SupplierIdentityService supplierIdentityService,
                            ChannelIdentityService channelIdentityService) {
        this.noticeService = noticeService;
        this.supplierIdentityService = supplierIdentityService;
        this.channelIdentityService = channelIdentityService;
    }

    @GetMapping("/api/supplier/notices")
    @OperatorOnly("s2b2c:supplier")
    public ResponseEntity<Map<String, Object>> supplierNotices(@RequestParam(defaultValue = "false") boolean unreadOnly,
                                                               @RequestParam(defaultValue = "1") int page,
                                                               @RequestParam(defaultValue = "10") int size) {
        Supplier supplier = supplierIdentityService.requireCurrent();
        return ResponseEntity.ok(noticeService.list("SUPPLIER", supplier.getId(), unreadOnly, page, size));
    }

    @GetMapping("/api/supplier/notices/unread-count")
    @OperatorOnly("s2b2c:supplier")
    public ResponseEntity<Map<String, Object>> supplierUnread() {
        Supplier supplier = supplierIdentityService.requireCurrent();
        return ResponseEntity.ok(Map.of("unread", noticeService.unreadCount("SUPPLIER", supplier.getId())));
    }

    @PutMapping("/api/supplier/notices/{id}/read")
    @OperatorOnly("s2b2c:supplier")
    public ResponseEntity<Map<String, Object>> supplierRead(@PathVariable Long id) {
        Supplier supplier = supplierIdentityService.requireCurrent();
        return ResponseEntity.ok(Map.of("success", noticeService.markRead("SUPPLIER", supplier.getId(), id)));
    }

    @PutMapping("/api/supplier/notices/read-all")
    @OperatorOnly("s2b2c:supplier")
    public ResponseEntity<Map<String, Object>> supplierReadAll() {
        Supplier supplier = supplierIdentityService.requireCurrent();
        return ResponseEntity.ok(Map.of("success", true,
                "updated", noticeService.markAllRead("SUPPLIER", supplier.getId())));
    }

    @GetMapping("/api/supplier/notice-preferences")
    @OperatorOnly("s2b2c:supplier")
    public ResponseEntity<?> supplierPreferences() {
        Supplier supplier = supplierIdentityService.requireCurrent();
        return ResponseEntity.ok(noticeService.preferences("SUPPLIER", supplier.getId()));
    }

    @PutMapping("/api/supplier/notice-preferences")
    @OperatorOnly("s2b2c:supplier")
    public ResponseEntity<Map<String, Object>> supplierUpdatePreference(@RequestBody Map<String, Object> body) {
        Supplier supplier = supplierIdentityService.requireCurrent();
        boolean ok = noticeService.updatePreference("SUPPLIER", supplier.getId(),
                String.valueOf(body.getOrDefault("noticeType", "")),
                Boolean.parseBoolean(String.valueOf(body.getOrDefault("enabled", true))));
        return ResponseEntity.ok(Map.of("success", ok, "message", ok ? "偏好已保存" : "未知通知类型"));
    }

    @GetMapping("/api/channel/notices")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> channelNotices(@RequestParam(defaultValue = "false") boolean unreadOnly,
                                                              @RequestParam(defaultValue = "1") int page,
                                                              @RequestParam(defaultValue = "10") int size) {
        ChannelPartner channel = channelIdentityService.requireApprovedChannel(null);
        return ResponseEntity.ok(noticeService.list("CHANNEL", channel.getId(), unreadOnly, page, size));
    }

    @GetMapping("/api/channel/notice-preferences")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<?> channelPreferences() {
        ChannelPartner channel = channelIdentityService.requireApprovedChannel(null);
        return ResponseEntity.ok(noticeService.preferences("CHANNEL", channel.getId()));
    }

    @PutMapping("/api/channel/notice-preferences")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> channelUpdatePreference(@RequestBody Map<String, Object> body) {
        ChannelPartner channel = channelIdentityService.requireApprovedChannel(null);
        boolean ok = noticeService.updatePreference("CHANNEL", channel.getId(),
                String.valueOf(body.getOrDefault("noticeType", "")),
                Boolean.parseBoolean(String.valueOf(body.getOrDefault("enabled", true))));
        return ResponseEntity.ok(Map.of("success", ok, "message", ok ? "偏好已保存" : "未知通知类型"));
    }

    @GetMapping("/api/channel/notices/unread-count")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> channelUnread() {
        ChannelPartner channel = channelIdentityService.requireApprovedChannel(null);
        return ResponseEntity.ok(Map.of("unread", noticeService.unreadCount("CHANNEL", channel.getId())));
    }

    @PutMapping("/api/channel/notices/{id}/read")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> channelRead(@PathVariable Long id) {
        ChannelPartner channel = channelIdentityService.requireApprovedChannel(null);
        return ResponseEntity.ok(Map.of("success", noticeService.markRead("CHANNEL", channel.getId(), id)));
    }

    @PutMapping("/api/channel/notices/read-all")
    @OperatorOnly("s2b2c:channel")
    public ResponseEntity<Map<String, Object>> channelReadAll() {
        ChannelPartner channel = channelIdentityService.requireApprovedChannel(null);
        return ResponseEntity.ok(Map.of("success", true,
                "updated", noticeService.markAllRead("CHANNEL", channel.getId())));
    }
}
