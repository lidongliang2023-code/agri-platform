package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.dto.PestDiagnosisRequest;
import com.agri.production.dto.TaskSaveDTO;
import com.agri.production.service.PestDiagnosisService;
import com.agri.production.service.TenantContextService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/production/ai")
public class PestDiagnosisController {
    private final PestDiagnosisService service;
    public PestDiagnosisController(PestDiagnosisService service) { this.service=service; }
    private String tenant() { return TenantContextService.currentTenantId(); }
    @PostMapping({"/pest-detection","/pest-detect","/pest-diagnosis"})
    public ApiResponse<Map<String,Object>> create(@Valid @RequestBody PestDiagnosisRequest request) { return ApiResponse.success(service.create(request,tenant())); }
    @GetMapping("/pest-detection")
    public ApiResponse<Map<String,Object>> list(@RequestParam(required=false) String farmId,@RequestParam(required=false) String plotId,
            @RequestParam(required=false) String status,@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="10") int pageSize) {
        return ApiResponse.success(service.list(tenant(),farmId,plotId,status,pageNum,pageSize));
    }
    @GetMapping("/pest-detection/knowledge-search") public ApiResponse<Map<String,Object>> search(@RequestParam String cropName,@RequestParam String symptoms,@RequestParam(required=false) String growthStage) {
        tenant();
        return ApiResponse.success(service.searchKnowledge(cropName,symptoms,growthStage));
    }
    @GetMapping("/pest-detection/{id}") public ApiResponse<Map<String,Object>> detail(@PathVariable String id) { return ApiResponse.success(service.detail(id,tenant(),false)); }
    @PostMapping("/pest-detection/{id}/retry") public ApiResponse<Map<String,Object>> retry(@PathVariable String id) { return ApiResponse.success(service.retry(id,tenant())); }
    @PostMapping("/pest-detection/{id}/review") public ApiResponse<Map<String,Object>> review(@PathVariable String id,@RequestBody Map<String,Object> request) {
        return ApiResponse.success(service.review(id,tenant(),(String)request.get("conclusion"),(String)request.get("advice"),(Boolean)request.get("modelCorrect")));
    }
    @PostMapping("/pest-detection/{id}/task") public ApiResponse<Map<String,Object>> task(@PathVariable String id,@Valid @RequestBody TaskSaveDTO request) {
        return ApiResponse.success(service.createTask(id,tenant(),request));
    }
    @PostMapping("/pest-detection/{id}/handoff") public ApiResponse<Map<String,Object>> handoff(@PathVariable String id,@RequestBody Map<String,String> request) {
        return ApiResponse.success(service.handoff(id,tenant(),request));
    }
    @PostMapping("/pest-detection/{id}/follow-up") public ApiResponse<Map<String,Object>> followUp(@PathVariable String id,@RequestBody Map<String,Object> request) {
        return ApiResponse.success(service.followUp(id,tenant(),(String)request.get("outcome"),(String)request.get("note"),Boolean.TRUE.equals(request.get("close"))));
    }
}
