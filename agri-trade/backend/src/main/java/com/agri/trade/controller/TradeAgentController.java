package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.service.TradeAgentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/trade/agents")
@RequiredArgsConstructor
public class TradeAgentController {
    private final TradeAgentService service;
    @GetMapping("/workspace")
    public ApiResponse<?> workspace(@RequestParam String role){return ApiResponse.success(service.workspace(role));}
    @PostMapping("/mandates")
    public ApiResponse<?> create(@RequestBody Map<String,Object> body){return ApiResponse.success(service.create(body));}
    @PostMapping("/mandates/{id}/revoke")
    public ApiResponse<?> revoke(@PathVariable String id){service.revoke(id);return ApiResponse.success();}
    @PostMapping("/mandates/{id}/run")
    public ApiResponse<?> run(@PathVariable String id){return ApiResponse.success(service.run(id));}
    @GetMapping("/mandates/{id}/comparison")
    public ApiResponse<?> compare(@PathVariable String id){return ApiResponse.success(service.compare(id));}
    @GetMapping("/sessions/{id}")
    public ApiResponse<?> detail(@PathVariable String id){return ApiResponse.success(service.detail(id));}
    @PostMapping("/sessions/{id}/confirm")
    public ApiResponse<?> confirm(@PathVariable String id,@RequestBody Map<String,Object> body){
        return ApiResponse.success(service.confirm(id,String.valueOf(body.get("role")),Integer.parseInt(String.valueOf(body.get("revision")))));
    }
    @PostMapping("/sessions/{id}/reject")
    public ApiResponse<?> reject(@PathVariable String id,@RequestBody Map<String,Object> body){service.reject(id,String.valueOf(body.getOrDefault("reason","")));return ApiResponse.success();}
}
