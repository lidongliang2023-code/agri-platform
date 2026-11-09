package com.agri.government.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.common.result.ApiResponse;
import com.agri.government.service.GovernmentScopeService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/government/ops/scopes")
@OperatorOnly("gov:admin")
public class GovernmentScopeController {
    private final GovernmentScopeService service;
    public GovernmentScopeController(GovernmentScopeService service) { this.service = service; }
    @GetMapping public ApiResponse<List<GovernmentScopeService.Scope>> list() {
        return ApiResponse.success(service.list());
    }
    @PostMapping public ApiResponse<GovernmentScopeService.Scope> create(@RequestBody GovernmentScopeService.Scope body) {
        return ApiResponse.success(service.save(null, body));
    }
    @PutMapping("/{id}") public ApiResponse<GovernmentScopeService.Scope> update(@PathVariable String id, @RequestBody GovernmentScopeService.Scope body) {
        return ApiResponse.success(service.save(id, body));
    }
}
