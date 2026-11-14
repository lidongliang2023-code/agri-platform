package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.ITechLearningService;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

/** 农技知识问答与培训陪练；不创建农事任务、不替代诊断与用药安全。 */
@RestController
@RequestMapping("/api/v1/production/tech-learning")
public class TechLearningController {
    private final ITechLearningService service;
    public TechLearningController(ITechLearningService service){this.service=service;}
    @PostMapping("/qa") public ApiResponse<Map<String,Object>> ask(@RequestBody Map<String,Object> body){return ApiResponse.success(service.ask(TenantContextService.currentTenantId(),body));}
    @GetMapping("/qa/history") public ApiResponse<List<Map<String,Object>>> history(@RequestParam(defaultValue="30") int limit){return ApiResponse.success(service.history(TenantContextService.currentTenantId(),limit));}
    @PostMapping("/training") public ApiResponse<Map<String,Object>> create(@RequestBody Map<String,Object> body){return ApiResponse.success(service.createTraining(TenantContextService.currentTenantId(),body));}
    @GetMapping("/training") public ApiResponse<List<Map<String,Object>>> trainings(@RequestParam(defaultValue="30") int limit){return ApiResponse.success(service.trainings(TenantContextService.currentTenantId(),limit));}
    @GetMapping("/training/{trainingId}") public ApiResponse<Map<String,Object>> detail(@PathVariable String trainingId){return ApiResponse.success(service.training(TenantContextService.currentTenantId(),trainingId));}
    @PostMapping("/training/{trainingId}/answers") public ApiResponse<Map<String,Object>> answer(@PathVariable String trainingId,@RequestBody Map<String,Object> body){return ApiResponse.success(service.answerTraining(TenantContextService.currentTenantId(),trainingId,Integer.parseInt(String.valueOf(body.get("questionNo"))),String.valueOf(body.get("answer"))));}
    @PostMapping("/training/{trainingId}/complete") public ApiResponse<Map<String,Object>> complete(@PathVariable String trainingId){return ApiResponse.success(service.completeTraining(TenantContextService.currentTenantId(),trainingId));}
}
