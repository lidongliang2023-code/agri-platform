package com.agri.trade.controller;
import com.agri.trade.service.OfficialMarketPriceService;
import com.agri.trade.service.PlatformIdentityService;
import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.SecurityUtils;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/trade/price/official")
public class OfficialMarketPriceController {
 private final OfficialMarketPriceService service;
 private final PlatformIdentityService identity;
 public OfficialMarketPriceController(OfficialMarketPriceService service,PlatformIdentityService identity){this.service=service;this.identity=identity;}
 @GetMapping public ApiResponse<Object> quotes(@RequestParam String crop){return ApiResponse.success(service.quotes(crop));}
 @GetMapping("/{id}") public ApiResponse<Object> resolve(@PathVariable String id,@RequestParam String crop){try{return ApiResponse.success(service.resolve(id,crop));}catch(IllegalArgumentException e){return ApiResponse.error(400,e.getMessage());}}
 @GetMapping("/batches") public ApiResponse<Object> batches(){return ApiResponse.success(service.batches());}
 @PostMapping("/sync") public ApiResponse<Object> sync(@RequestParam(defaultValue="NX") String source){
  var scope=identity.currentScope();
  if(!scope.resolved() || scope.bindings().stream().noneMatch(b -> "owner".equalsIgnoreCase(String.valueOf(b.get("roleInMerchant"))))) return ApiResponse.error(403,"仅已绑定经营主体所有者可触发公共行情同步");
  return ApiResponse.success(service.sync("用户 ID："+SecurityUtils.getUserId(), source));
 }
}
