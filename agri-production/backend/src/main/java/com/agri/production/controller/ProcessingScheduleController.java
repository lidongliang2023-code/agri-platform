package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.ProcessingScheduleService;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/production/processing-schedules")
public class ProcessingScheduleController {
    private final ProcessingScheduleService service;
    public ProcessingScheduleController(ProcessingScheduleService service){this.service=service;}
    private String tenant(){return TenantContextService.currentTenantId();}
    private String operator(){return TenantContextService.currentOperator();}
    @GetMapping("/config") public ApiResponse<?> config(){return ApiResponse.success(service.config(tenant()));}
    @PutMapping("/config") public ApiResponse<?> config(@RequestBody Map<String,Object> req){String t=tenant();TenantContextService.requireSubjectOwner();return ApiResponse.success(service.saveConfig(t,req,operator()));}
    @GetMapping("/sources") public ApiResponse<?> sources(){return ApiResponse.success(service.sources(tenant()));}
    @GetMapping public ApiResponse<?> list(@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize){return ApiResponse.success(service.list(tenant(),pageNum,pageSize));}
    @GetMapping("/{id}") public ApiResponse<?> detail(@PathVariable String id){return ApiResponse.success(service.detail(tenant(),id));}
    @PostMapping("/solve") public ApiResponse<?> solve(@RequestBody Map<String,Object> req){return ApiResponse.success(service.solve(tenant(),req,operator()));}
    @PostMapping("/{id}/decisions") public ApiResponse<?> decisions(@PathVariable String id,@RequestBody Map<String,Object> req){return ApiResponse.success(service.decide(tenant(),id,req,operator()));}
    @PostMapping("/{id}/approve") public ApiResponse<?> approve(@PathVariable String id,@RequestBody Map<String,String> req){String t=tenant();TenantContextService.requireSubjectOwner();return ApiResponse.success(service.approve(t,id,req.getOrDefault("reason",""),operator()));}
    @PostMapping("/{id}/publish") public ApiResponse<?> publish(@PathVariable String id){return ApiResponse.success(service.publish(tenant(),id,operator()));}
    @PostMapping("/{id}/works/{workId}") public ApiResponse<?> work(@PathVariable String id,@PathVariable String workId,@RequestBody Map<String,Object> req){return ApiResponse.success(service.work(tenant(),id,workId,req,operator()));}
    @PostMapping("/{id}/outsource/{outsourceId}/receipt") public ApiResponse<?> receipt(@PathVariable String id,@PathVariable String outsourceId,@RequestBody Map<String,Object> req){return ApiResponse.success(service.receipt(tenant(),id,outsourceId,req,operator()));}
    @PostMapping("/{id}/close") public ApiResponse<?> close(@PathVariable String id){return ApiResponse.success(service.close(tenant(),id,operator()));}
    @PostMapping("/{id}/cancel") public ApiResponse<?> cancel(@PathVariable String id,@RequestBody Map<String,String> req){String t=tenant();TenantContextService.requireSubjectOwner();return ApiResponse.success(service.cancel(t,id,req.getOrDefault("reason",""),operator()));}
}
