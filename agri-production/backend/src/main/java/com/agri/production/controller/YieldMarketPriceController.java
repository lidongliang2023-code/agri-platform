package com.agri.production.controller;
import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.YieldMarketPriceClient;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1/production/yield-forecasts/market")
public class YieldMarketPriceController {
 private final YieldMarketPriceClient service;
 public YieldMarketPriceController(YieldMarketPriceClient service){this.service=service;}
 @GetMapping public ApiResponse<Object> quotes(@RequestParam String crop){return ApiResponse.success(service.quotes(crop));}
 @GetMapping("/batches") public ApiResponse<Object> batches(){return ApiResponse.success(service.batches());}
 @PostMapping("/sync") public ApiResponse<Object> sync(@RequestParam(defaultValue="NX") String source){TenantContextService.requireSubjectOwner();return ApiResponse.success(service.sync(source));}
}
