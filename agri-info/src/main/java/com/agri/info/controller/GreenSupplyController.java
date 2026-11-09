package com.agri.info.controller;
import com.agri.info.integration.GreenSupplyService;
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
public class GreenSupplyController {
    private final GreenSupplyService service;private final RestTemplate auth;private final String platform;
    public GreenSupplyController(GreenSupplyService service,@Value("${services.platform.url:http://localhost:8093}")String platform){this.service=service;this.platform=platform;var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(3000);f.setReadTimeout(5000);auth=new RestTemplate(f);}
    private String owner(String token){
        if(token==null||!token.startsWith("Bearer "))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"请先登录");
        try{var h=new HttpHeaders();h.set("Authorization",token);var r=auth.exchange(platform+"/api/v1/auth/me",HttpMethod.GET,new HttpEntity<>(h),Map.class).getBody();
            if(r!=null&&r.get("data") instanceof Map<?,?> d&&d.get("id")!=null)return d.get("id").toString();
        }catch(Exception ignored){}throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"登录状态无效，请重新登录");
    }

    @GetMapping("/api/v1/info/public/green/{kind}")
    public ApiResponse<?> publicList(@PathVariable String kind){return ApiResponse.success(service.list(kind,null,true));}
    @GetMapping("/api/v1/info/green/{kind}") @OperatorOnly("info:consumer")
    public ApiResponse<?> mine(@PathVariable String kind,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(service.list(kind,owner(token),false));}
    @PostMapping("/api/v1/info/green/{kind}/{id}") @OperatorOnly("info:consumer")
    public ApiResponse<?> save(@PathVariable String kind,@PathVariable long id,@RequestBody Map<String,Object>b,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(service.save(kind,id,b,owner(token),false));}
    @PostMapping("/api/v1/info/green/{kind}/{id}/status") @OperatorOnly("info:consumer")
    public ApiResponse<?> status(@PathVariable String kind,@PathVariable long id,@RequestBody Map<String,Object>b,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(service.transition(kind,id,b,owner(token),false));}
    @PostMapping("/api/v1/info/green/project/{id}/export") @OperatorOnly("info:consumer")
    public ApiResponse<?> export(@PathVariable long id,@RequestParam int revision,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(service.exportReport(id,revision,owner(token),false));}
    @PostMapping("/api/v1/info/ops/green/project/{id}/export") @OperatorOnly("info:admin")
    public ApiResponse<?> opsExport(@PathVariable long id,@RequestParam int revision,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(service.exportReport(id,revision,owner(token),true));}
    @GetMapping("/api/v1/info/ops/green/{kind}") @OperatorOnly("info:admin")
    public ApiResponse<?> ops(@PathVariable String kind,@RequestHeader(value="Authorization",required=false)String token){owner(token);return ApiResponse.success(service.list(kind,null,false));}
    @PostMapping("/api/v1/info/ops/green/{kind}/{id}") @OperatorOnly("info:admin")
    public ApiResponse<?> opsSave(@PathVariable String kind,@PathVariable long id,@RequestBody Map<String,Object>b,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(service.save(kind,id,b,owner(token),true));}
    @PostMapping("/api/v1/info/ops/green/{kind}/{id}/status") @OperatorOnly("info:admin")
    public ApiResponse<?> opsStatus(@PathVariable String kind,@PathVariable long id,@RequestBody Map<String,Object>b,@RequestHeader(value="Authorization",required=false)String token){return ApiResponse.success(service.transition(kind,id,b,owner(token),true));}
}
