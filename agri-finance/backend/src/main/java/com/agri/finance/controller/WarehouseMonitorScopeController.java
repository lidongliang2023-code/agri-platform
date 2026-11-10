package com.agri.finance.controller;

import com.agri.finance.service.WarehouseMonitorAuthorization;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/** 仅供生产域回查：服务密钥加原调用方平台令牌，任一缺失均拒绝。 */
@RestController
public class WarehouseMonitorScopeController {
    private final WarehouseMonitorAuthorization authorization;
    private final String token;
    public WarehouseMonitorScopeController(WarehouseMonitorAuthorization authorization,
            @Value("${finance-warehouse.token:${AGRI_FINANCE_WAREHOUSE_TOKEN:}}") String token) {
        this.authorization = authorization; this.token = token;
    }
    @GetMapping("/internal/warehouse-monitor/{receiptId}/scope")
    public ResponseEntity<Map<String, Object>> scope(@PathVariable String receiptId,
            @RequestHeader(value="X-Finance-Warehouse-Token", defaultValue="") String supplied) {
        if (token.isBlank() || !MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8),
                supplied.getBytes(StandardCharsets.UTF_8))) {
            return ResponseEntity.status(403).body(Map.of("code",403,"message","仓储监控服务鉴权失败"));
        }
        return ResponseEntity.ok(Map.of("code",0,"data",authorization.scope(receiptId)));
    }
}
