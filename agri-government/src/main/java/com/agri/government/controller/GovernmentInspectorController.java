package com.agri.government.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.common.result.ApiResponse;
import com.agri.government.repository.GovernmentOpsRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 移动执法端接口，使用 gov:inspector 与监管运营端的 gov:admin 分离。
 */
@RestController
@RequestMapping("/api/v1/government/mobile")
@OperatorOnly("gov:inspector")
public class GovernmentInspectorController {

    private final GovernmentOpsRepository repository;

    public GovernmentInspectorController(GovernmentOpsRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/workbench")
    public ApiResponse<Map<String, Object>> workbench() {
        return ApiResponse.success(repository.mobileWorkbench());
    }

    @GetMapping("/tasks")
    public ApiResponse<List<Map<String, Object>>> tasks() {
        return ApiResponse.success(repository.mobileTasks());
    }

    @GetMapping("/tasks/{id}")
    public ApiResponse<Map<String, Object>> task(@PathVariable long id) {
        return ApiResponse.success(repository.mobileTask(id));
    }

    @PostMapping("/tasks/{id}/submit")
    public ApiResponse<Map<String, Object>> submitTask(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("检查结果已提交", repository.submitTask(id, body));
    }

    @PostMapping("/scan")
    public ApiResponse<Map<String, Object>> scan(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.mobileScan(String.valueOf(body.getOrDefault("code", ""))));
    }

    @GetMapping("/cases")
    public ApiResponse<List<Map<String, Object>>> cases() {
        return ApiResponse.success(repository.mobileCases());
    }

    @PostMapping("/cases")
    public ApiResponse<Map<String, Object>> createCase(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("立案登记已提交", repository.createCase(body));
    }

    @PostMapping("/evidence")
    public ApiResponse<Map<String, Object>> evidence(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("证据已保存并生成证据链哈希", repository.addEvidence(body));
    }

    /** 我的取证记录（取证是真落库的，页面能看到自己交过什么、哈希是多少）。 */
    @GetMapping("/evidence")
    public ApiResponse<List<Map<String, Object>>> evidenceList() {
        return ApiResponse.success(repository.myEvidence());
    }

    /**
     * 执法人员的收件箱。
     *
     * <p>原来移动端调的是 {@code /messages?userType=inspector}，而那个接口挂在只允许
     * {@code gov:citizen} 的主体端控制器上 —— 执法账号（gov:inspector）读收件箱必然 403。</p>
     */
    @GetMapping("/messages")
    public ApiResponse<List<Map<String, Object>>> messages() {
        return ApiResponse.success(repository.inspectorMessages());
    }

    @PostMapping("/messages/read-all")
    public ApiResponse<Map<String, Object>> readMessages() {
        return ApiResponse.success(repository.readInspectorMessages());
    }
}
