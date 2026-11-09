package com.agri.production.controller.admin;
import com.agri.production.common.entity.*;
import com.agri.production.entity.FarmComplianceCheck;
import com.agri.production.service.*;
import com.agri.production.vo.FarmVO;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import com.agri.production.common.exception.BusinessException;
import java.util.*;
/** 此路径由平台 RBAC 统一验证 production:read / production:write。 */
@RestController
@RequestMapping("/api/v1/production/admin/farm-supervision")
public class FarmSupervisionController {
 private final FarmSupervisionService service;
 private final RestTemplate rest;
 @Value("${platform.services.platform.url:http://localhost:8093}") private String platformUrl;
 public FarmSupervisionController(FarmSupervisionService service){this.service=service;var factory=new org.springframework.http.client.SimpleClientHttpRequestFactory();factory.setConnectTimeout(2000);factory.setReadTimeout(3000);rest=new RestTemplate(factory);}
 private String actor(){
  try{HttpHeaders h=new HttpHeaders();h.set(HttpHeaders.AUTHORIZATION,TenantContextService.currentAuthorization());var res=rest.exchange(platformUrl+"/api/v1/auth/me",HttpMethod.GET,new HttpEntity<>(h),Map.class).getBody();
   if(res==null||!(res.get("data") instanceof Map u)||u.get("id")==null)throw new IllegalStateException();
   return FarmSupervisionService.text(u.get("username"),"运营账号",64)+" · 用户 ID："+u.get("id");
  }catch(Exception e){throw new BusinessException(503,"无法确认运营操作人，操作未保存");}
 }
 @GetMapping public ApiResponse<PageResult<FarmVO>> farms(@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize,@RequestParam(required=false) String keyword,@RequestParam(required=false) String tenantId,@RequestParam(required=false) String status){return ApiResponse.success(service.farms(pageNum,pageSize,keyword,tenantId,status));}
 @GetMapping("/farms/{id}") public ApiResponse<Map<String,Object>> detail(@PathVariable Long id){return ApiResponse.success(service.detail(id));}
 @GetMapping("/checks") public ApiResponse<PageResult<FarmComplianceCheck>> checks(@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize,@RequestParam(required=false) Long farmId,@RequestParam(required=false) String rectifyStatus,@RequestParam(required=false) Integer result){return ApiResponse.success(service.checks(pageNum,pageSize,farmId,null,rectifyStatus,result));}
 @GetMapping("/checks/{code}") public ApiResponse<FarmComplianceCheck> get(@PathVariable String code){return ApiResponse.success(service.get(code,null));}
 @PostMapping("/checks") public ApiResponse<FarmComplianceCheck> create(@RequestBody Map<String,Object> body){return ApiResponse.success(service.create(body,actor()));}
 @PostMapping("/checks/{code}/review") public ApiResponse<FarmComplianceCheck> review(@PathVariable String code,@RequestBody Map<String,Object> body){
  if(!(body.get("approved") instanceof Boolean))throw new BusinessException(400,"请选择复核结论");
  return ApiResponse.success(service.review(code,Boolean.TRUE.equals(body.get("approved")),FarmSupervisionService.text(body.get("remark"),"复核意见",500),actor()));}
}
