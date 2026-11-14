package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.dto.CalendarArrangeRequest;
import com.agri.production.service.CalendarArrangementService;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/production/calendar-arrangements")
public class CalendarArrangementController {
    private final CalendarArrangementService service;
    public CalendarArrangementController(CalendarArrangementService service) {this.service=service;}
    private String tenant() {return TenantContextService.currentTenantId();}
    public record Action(int revision,String reason,boolean crossMonthConfirmed) {}
    public record Revision(int revision,String reason,CalendarArrangeRequest input,boolean crossMonthConfirmed) {}
    public record WeatherRequest(String farmId, java.time.LocalDate weekStart) {}
    @GetMapping("/context") public ApiResponse<Map<String,Object>> context(@RequestParam String farmId) {return ApiResponse.success(service.context(tenant(),farmId));}
    @GetMapping("/weather") public ApiResponse<Map<String,Object>> weather(@RequestParam String farmId,@RequestParam java.time.LocalDate weekStart) {return ApiResponse.success(service.latestWeather(tenant(),farmId,weekStart));}
    @PostMapping("/weather/refresh") public ApiResponse<Map<String,Object>> refreshWeather(@RequestBody WeatherRequest request) {return ApiResponse.success(service.refreshWeather(tenant(),request.farmId(),request.weekStart()));}
    @GetMapping public ApiResponse<List<Map<String,Object>>> list(@RequestParam String farmId) {return ApiResponse.success(service.list(tenant(),farmId));}
    @PostMapping public ApiResponse<Map<String,Object>> create(@RequestBody CalendarArrangeRequest input) {return ApiResponse.success(service.create(tenant(),input));}
    @GetMapping("/{id}") public ApiResponse<Map<String,Object>> detail(@PathVariable String id) {return ApiResponse.success(service.detail(tenant(),id));}
    @PutMapping("/{id}") public ApiResponse<Map<String,Object>> revise(@PathVariable String id,@RequestBody Revision r) {return ApiResponse.success(service.revise(tenant(),id,r.revision(),r.reason(),r.input()));}
    @PostMapping("/{id}/reschedule") public ApiResponse<Map<String,Object>> reschedule(@PathVariable String id,@RequestBody Revision r) {return ApiResponse.success(service.reschedule(tenant(),id,r.revision(),r.reason(),r.crossMonthConfirmed(),r.input()));}
    @PostMapping("/{id}/approve") public ApiResponse<Map<String,Object>> approve(@PathVariable String id,@RequestBody Action a) {return ApiResponse.success(service.approve(tenant(),id,a.revision(),a.reason(),a.crossMonthConfirmed()));}
    @PostMapping("/{id}/publish") public ApiResponse<Map<String,Object>> publish(@PathVariable String id,@RequestBody Action a) {return ApiResponse.success(service.publish(tenant(),id,a.revision()));}
    @PostMapping("/{id}/close") public ApiResponse<Map<String,Object>> close(@PathVariable String id,@RequestBody Action a) {return ApiResponse.success(service.close(tenant(),id,a.revision(),a.reason()));}
    @PostMapping("/{id}/explain") public ApiResponse<Map<String,Object>> explain(@PathVariable String id,@RequestBody Action a) {return ApiResponse.success(service.explain(tenant(),id,a.revision()));}
    @GetMapping("/interventions") public ApiResponse<List<Map<String,Object>>> interventions(@RequestParam String farmId) {return ApiResponse.success(service.interventions(tenant(),farmId));}
    @PostMapping("/interventions/{id}/resolve") public ApiResponse<Boolean> resolve(@PathVariable String id,@RequestBody Action a) {service.resolveIntervention(tenant(),id,a.reason());return ApiResponse.success(true);}
}
