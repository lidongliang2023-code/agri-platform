package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.MobileWorkspaceSessionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/production/mobile-session")
public class MobileWorkspaceSessionController {
    private final MobileWorkspaceSessionService service;
    public MobileWorkspaceSessionController(MobileWorkspaceSessionService service) { this.service = service; }
    @PostMapping("/ticket")
    public ResponseEntity<ApiResponse<Map<String,Object>>> ticket(HttpServletRequest request, @RequestBody Map<String,Object> body) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(service.issue(request, body)));
    }
    @PostMapping("/exchange")
    public ResponseEntity<ApiResponse<Map<String,Object>>> exchange(@RequestBody Map<String,Object> body) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(service.exchange(body)));
    }
}
