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
@lombok.extern.slf4j.Slf4j
@RestController
@RequestMapping("/api/v1/production/admin/farm-supervision")
public class FarmSupervisionController {
 private final FarmSupervisionService service;
 private final RestTemplate rest;
 @Value("${services.platform.url:http://localhost:8093}") private String platformUrl;
 public FarmSupervisionController(FarmSupervisionService service){this.service=service;var factory=new org.springframework.http.client.SimpleClientHttpRequestFactory();factory.setConnectTimeout(2000);factory.setReadTimeout(3000);rest=new RestTemplate(factory);}
 /** 按当前响应去重查询权威主体档案；名称服务不可用时保留监管数据并明确展示缺失状态。 */
 private Map<String,String> subjectNames(Collection<String> tenantIds){
  var names=new HashMap<String,String>();
  boolean unavailable=false;
  for(String id:new LinkedHashSet<>(tenantIds)){
   if(id==null||id.isBlank()){names.put(id,"未关联经营主体");continue;}
   if(unavailable){names.put(id,"主体名称暂不可用");continue;}
   try{
    HttpHeaders headers=new HttpHeaders();headers.set(HttpHeaders.AUTHORIZATION,TenantContextService.currentAuthorization());
    var body=rest.exchange(platformUrl+"/api/v1/admin/merchants/{id}",HttpMethod.GET,new HttpEntity<>(headers),Map.class,id).getBody();
    if(body==null||!"0".equals(String.valueOf(body.get("code")))||!(body.get("data") instanceof Map merchant)){
     if(body!=null&&"404".equals(String.valueOf(body.get("code")))){names.put(id,"主体已注销或不存在");continue;}
     throw new IllegalStateException("经营主体档案未返回有效数据");
    }
    String name=Objects.toString(merchant.get("name"),"").trim();
    names.put(id,name.isEmpty()?"主体名称未登记":name);
   }catch(org.springframework.web.client.HttpClientErrorException.NotFound e){
    names.put(id,"主体已注销或不存在");
   }catch(RuntimeException e){
    log.warn("监管经营主体名称查询失败，保留监管台账：{}",e.getClass().getSimpleName());
    names.put(id,"主体名称暂不可用");unavailable=true;
   }
  }
  return names;
 }
 private String actor(){
  try{HttpHeaders h=new HttpHeaders();h.set(HttpHeaders.AUTHORIZATION,TenantContextService.currentAuthorization());var res=rest.exchange(platformUrl+"/api/v1/auth/me",HttpMethod.GET,new HttpEntity<>(h),Map.class).getBody();
   if(res==null||!(res.get("data") instanceof Map u)||u.get("id")==null)throw new IllegalStateException();
   return FarmSupervisionService.text(u.get("username"),"运营账号",64)+" · 用户 ID："+u.get("id");
  }catch(Exception e){throw new BusinessException(503,"无法确认运营操作人，操作未保存");}
 }
 @org.springframework.beans.factory.annotation.Autowired private PlotBoundaryService boundaryService;
 @GetMapping("/farms/{id}/plot-boundary-checks") public ApiResponse<List<Map<String,Object>>> boundaryChecks(@PathVariable Long id){return ApiResponse.success(boundaryService.report(service.owned(id,null)));}
 @GetMapping public ApiResponse<PageResult<FarmVO>> farms(@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize,@RequestParam(required=false) String keyword,@RequestParam(required=false) String tenantId,@RequestParam(required=false) String status){var result=service.farms(pageNum,pageSize,keyword,tenantId,status);var names=subjectNames(result.getRecords().stream().map(FarmVO::getTenantId).toList());result.getRecords().forEach(farm->farm.setTenantName(names.get(farm.getTenantId())));return ApiResponse.success(result);}
 @GetMapping("/map") public ApiResponse<List<Map<String,Object>>> map(){var rows=service.mapPoints(null);var names=subjectNames(rows.stream().map(row->Objects.toString(row.get("tenantId"),null)).toList());rows.forEach(row->row.put("tenantName",names.get(Objects.toString(row.get("tenantId"),null))));return ApiResponse.success(rows);}
 @GetMapping("/farms/{id}") public ApiResponse<Map<String,Object>> detail(@PathVariable Long id){var detail=service.detail(id);if(detail.get("farm") instanceof FarmVO farm)farm.setTenantName(subjectNames(Collections.singletonList(farm.getTenantId())).get(farm.getTenantId()));return ApiResponse.success(detail);}
 @PutMapping("/farms/{id}/coordinates") public ApiResponse<FarmVO> coordinates(@PathVariable Long id,@jakarta.validation.Valid @RequestBody com.agri.production.dto.FarmCoordinatesDTO body){return ApiResponse.success(service.updateCoordinates(id,body,actor()));}
 @PutMapping("/farms/{id}/boundary") public ApiResponse<FarmVO> boundary(@PathVariable Long id,@jakarta.validation.Valid @RequestBody com.agri.production.dto.FarmBoundaryDTO body){return ApiResponse.success(service.updateBoundary(id,body,actor()));}
 @GetMapping("/checks") public ApiResponse<PageResult<FarmComplianceCheck>> checks(@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize,@RequestParam(required=false) Long farmId,@RequestParam(required=false) String rectifyStatus,@RequestParam(required=false) Integer result){return ApiResponse.success(service.checks(pageNum,pageSize,farmId,null,rectifyStatus,result));}
 @GetMapping("/checks/{code}") public ApiResponse<FarmComplianceCheck> get(@PathVariable String code){return ApiResponse.success(service.get(code,null));}
 @PostMapping("/checks") public ApiResponse<FarmComplianceCheck> create(@RequestBody Map<String,Object> body){return ApiResponse.success(service.create(body,actor()));}
 @PostMapping("/checks/{code}/review") public ApiResponse<FarmComplianceCheck> review(@PathVariable String code,@RequestBody Map<String,Object> body){
  if(!(body.get("approved") instanceof Boolean))throw new BusinessException(400,"请选择复核结论");
  return ApiResponse.success(service.review(code,Boolean.TRUE.equals(body.get("approved")),FarmSupervisionService.text(body.get("remark"),"复核意见",500),actor()));}
}
