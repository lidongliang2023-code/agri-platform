package com.agri.info.controller;

import com.agri.info.integration.CloudFactoryService;
import com.agri.common.result.ApiResponse;
import com.agri.common.rbac.OperatorOnly;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import java.util.*;

@RestController
public class CloudFactoryController {
    private final CloudFactoryService service;
    private final com.agri.info.integration.FactoryVisitReportService reports;
    private final RestTemplate auth;
    private final String platform;
    public CloudFactoryController(CloudFactoryService service,com.agri.info.integration.FactoryVisitReportService reports,@Value("${services.platform.url:http://localhost:8093}")String platform){this.service=service;this.reports=reports;this.platform=platform;var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(3000);f.setReadTimeout(5000);auth=new RestTemplate(f);}
    private String owner(String token){
        if(token==null||!token.startsWith("Bearer "))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"请先登录");
        try{var h=new HttpHeaders();h.set("Authorization",token);var r=auth.exchange(platform+"/api/v1/auth/me",HttpMethod.GET,new HttpEntity<>(h),Map.class).getBody();
            if(r!=null&&r.get("data") instanceof Map<?,?> d&&d.get("id")!=null)return d.get("id").toString();
        }catch(Exception ignored){}throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"登录状态无效，请重新登录");
    }
    @GetMapping("/api/v1/info/public/cloud-factories")
    public ApiResponse<?> list(@RequestParam(defaultValue="")String keyword,@RequestParam(defaultValue="")String category){return ApiResponse.success(service.list(false,keyword,category));}
    @GetMapping("/api/v1/info/public/cloud-factories/{id}")
    public ApiResponse<?> detail(@PathVariable long id){return ApiResponse.success(service.detail(id,false));}
    // 不放入公开路径。依赖平台正常用户权限，并再次校验令牌对应的真实用户编号。
    @GetMapping("/api/v1/info/cloud-factory/visits")
    @OperatorOnly("info:consumer")
    public ApiResponse<?> mine(@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(service.visits(owner(token)));}
    @PostMapping("/api/v1/info/cloud-factory/{id}/visits")
    @OperatorOnly("info:consumer")
    public ApiResponse<?> book(@PathVariable long id,@RequestBody Map<String,Object>b,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(service.book(id,owner(token),b));}
    @PostMapping("/api/v1/info/cloud-factory/visits/{id}/cancel")
    @OperatorOnly("info:consumer")
    public ApiResponse<?> cancel(@PathVariable long id,@RequestHeader(value="Authorization",required=false)String token){String who=owner(token);service.transition(id,"cancelled","用户取消预约",who,who);return ApiResponse.success(Map.of("message","已取消"));}
    @GetMapping("/api/v1/info/ops/cloud-factories") @OperatorOnly("info:admin")
    public ApiResponse<?> opsList(){return ApiResponse.success(service.list(true,"",""));}
    @GetMapping("/api/v1/info/ops/cloud-factories/{id}") @OperatorOnly("info:admin")
    public ApiResponse<?> opsDetail(@PathVariable long id){return ApiResponse.success(service.detail(id,true));}
    @PostMapping("/api/v1/info/ops/cloud-factories") @OperatorOnly("info:admin")
    public ApiResponse<?> create(@RequestBody Map<String,Object>b,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(service.save(null,b,owner(token)));}
    @PutMapping("/api/v1/info/ops/cloud-factories/{id}") @OperatorOnly("info:admin")
    public ApiResponse<?> save(@PathVariable long id,@RequestBody Map<String,Object>b,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(service.save(id,b,owner(token)));}
    @PostMapping("/api/v1/info/ops/cloud-factories/{id}/status") @OperatorOnly("info:admin")
    public ApiResponse<?> publish(@PathVariable long id,@RequestBody Map<String,Object>b,@RequestHeader(value="Authorization",required=false)String token){service.publish(id,Objects.toString(b.get("status")),owner(token));return ApiResponse.success(Map.of("message","状态已更新"));}
    @GetMapping("/api/v1/info/ops/cloud-factory-visits") @OperatorOnly("info:admin")
    public ApiResponse<?> visits(){return ApiResponse.success(service.visits(null));}
    @PostMapping("/api/v1/info/ops/cloud-factory-visits/{id}/status") @OperatorOnly("info:admin")
    public ApiResponse<?> handle(@PathVariable long id,@RequestBody Map<String,Object>b,@RequestHeader(value="Authorization",required=false)String token){service.transition(id,Objects.toString(b.get("status")),Objects.toString(b.get("note"),""),null,owner(token));return ApiResponse.success(Map.of("message","处理已保存"));}
    @GetMapping("/api/v1/info/cloud-factory/visits/{id}/report") @OperatorOnly("info:consumer")
    public ApiResponse<?> myReport(@PathVariable long id,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(reports.get(id,owner(token)));}
    @GetMapping("/api/v1/info/ops/cloud-factory-visits/{id}/report") @OperatorOnly("info:admin")
    public ApiResponse<?> report(@PathVariable long id){return ApiResponse.success(reports.get(id,null));}
    @PostMapping("/api/v1/info/ops/cloud-factory-visits/{id}/report") @OperatorOnly("info:admin")
    public ApiResponse<?> saveReport(@PathVariable long id,@RequestBody Map<String,Object>b,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(reports.save(id,b,owner(token)));}
    @PostMapping("/api/v1/info/ops/cloud-factory-visits/{id}/report/status") @OperatorOnly("info:admin")
    public ApiResponse<?> reportStatus(@PathVariable long id,@RequestBody Map<String,Object>b,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(reports.transition(id,b,owner(token)));}
}
