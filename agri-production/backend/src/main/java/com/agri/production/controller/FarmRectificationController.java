package com.agri.production.controller;
import com.agri.production.common.entity.*;
import com.agri.production.entity.FarmComplianceCheck;
import com.agri.production.service.*;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController
@RequestMapping("/api/v1/production/farm-rectifications")
public class FarmRectificationController {
 private final FarmSupervisionService service;private final FarmIdResolver resolver;
 public FarmRectificationController(FarmSupervisionService service,FarmIdResolver resolver){this.service=service;this.resolver=resolver;}
 @GetMapping public ApiResponse<PageResult<FarmComplianceCheck>> list(@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize,@RequestParam(required=false) String farmId,@RequestParam(required=false) String rectifyStatus){String tenant=TenantContextService.currentTenantId();return ApiResponse.success(service.checks(pageNum,pageSize,resolver.resolveFilter(farmId,tenant),tenant,rectifyStatus,null));}
 @GetMapping("/{code}") public ApiResponse<FarmComplianceCheck> get(@PathVariable String code){return ApiResponse.success(service.get(code,TenantContextService.currentTenantId()));}
 @PostMapping("/{code}/submit") public ApiResponse<FarmComplianceCheck> submit(@PathVariable String code,@RequestBody Map<String,Object> body){return ApiResponse.success(service.submit(code,TenantContextService.currentTenantId(),FarmSupervisionService.text(body.get("remark"),"整改结果与凭据说明",500),TenantContextService.currentOperator()));}
}
