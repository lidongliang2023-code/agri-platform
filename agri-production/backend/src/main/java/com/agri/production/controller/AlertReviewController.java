package com.agri.production.controller;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.AlertReviewService;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController
@RequestMapping("/api/v1/production/alerts/reviews")
public class AlertReviewController {
    private final AlertReviewService service;
    public AlertReviewController(AlertReviewService service){this.service=service;}
    @GetMapping public ApiResponse<?> list(@RequestParam(required=false) String farmId,@RequestParam(defaultValue="ALL") String status,@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize){return ApiResponse.success(service.list(TenantContextService.currentTenantId(),farmId,status,pageNum,pageSize));}
    @GetMapping("/{code}") public ApiResponse<?> detail(@PathVariable String code){return ApiResponse.success(service.detail(TenantContextService.currentTenantId(),code));}
    @PostMapping("/{code}") public ApiResponse<?> save(@PathVariable String code,@RequestBody Map<String,Object> body){return ApiResponse.success(service.save(TenantContextService.currentTenantId(),code,body));}
}
