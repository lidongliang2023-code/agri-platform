package com.agri.service.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.common.result.ApiResponse;
import com.agri.service.repository.ExpertRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/service")
public class ExpertController {
    private final ExpertRepository repository;
    public ExpertController(ExpertRepository repository) { this.repository = repository; }

    @GetMapping("/expert/profile")
    @OperatorOnly("service:read")
    public ApiResponse<Map<String,Object>> profile() { return ApiResponse.success(repository.profile()); }

    @GetMapping("/expert/consultations")
    @OperatorOnly("service:read")
    public ApiResponse<List<Map<String,Object>>> consultations() { return ApiResponse.success(repository.consultations()); }

    @PostMapping("/expert/consultations/{id}/reply")
    @OperatorOnly("service:write")
    public ApiResponse<Map<String,Object>> reply(@PathVariable long id, @RequestBody Map<String,Object> body) {
        return ApiResponse.success("专家回复已保存并通知用户", repository.reply(id, body));
    }

    @GetMapping("/ops/experts")
    @OperatorOnly("service:admin")
    public ApiResponse<List<Map<String,Object>>> experts() { return ApiResponse.success(repository.experts()); }

    @PutMapping("/ops/experts/{id}/user-binding")
    @OperatorOnly("service:admin")
    public ApiResponse<Map<String,Object>> bind(@PathVariable long id, @RequestBody Map<String,Object> body) {
        return ApiResponse.success("专家账号绑定已更新", repository.bind(id, body));
    }
}
