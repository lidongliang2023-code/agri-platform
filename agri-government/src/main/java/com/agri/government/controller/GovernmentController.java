package com.agri.government.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.common.result.ApiResponse;
import com.agri.government.repository.GovernmentRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/government")
@OperatorOnly("gov:citizen")
public class GovernmentController {
    private final GovernmentRepository repository;

    public GovernmentController(GovernmentRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/home")
    public ApiResponse<Map<String, Object>> home() {
        return ApiResponse.success(repository.home());
    }

    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> me() {
        return ApiResponse.success(repository.me());
    }

    @GetMapping("/licenses")
    public ApiResponse<List<Map<String, Object>>> licenses() {
        return ApiResponse.success(repository.licenses());
    }

    @GetMapping("/reports")
    public ApiResponse<List<Map<String, Object>>> reports() {
        return ApiResponse.success(repository.reports());
    }

    @PostMapping("/reports")
    public ApiResponse<Map<String, Object>> createReport(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("数据报送成功", repository.createReport(body));
    }

    @GetMapping("/self-check")
    public ApiResponse<Map<String, Object>> selfCheck() {
        return ApiResponse.success(repository.selfCheck());
    }

    @PostMapping("/self-check")
    public ApiResponse<Map<String, Object>> runSelfCheck() {
        return ApiResponse.success("AI 合规自查完成", repository.runSelfCheck());
    }

    @GetMapping("/credit")
    public ApiResponse<Map<String, Object>> credit() {
        return ApiResponse.success(repository.credit());
    }

    @GetMapping("/credit-repairs")
    public ApiResponse<List<Map<String, Object>>> repairs() {
        return ApiResponse.success(repository.repairs());
    }

    @PostMapping("/credit-repairs")
    public ApiResponse<Map<String, Object>> createRepair(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("信用修复申请已提交", repository.createRepair(body));
    }

    @GetMapping("/inspections")
    public ApiResponse<List<Map<String, Object>>> inspections() {
        return ApiResponse.success(repository.inspections());
    }

    @GetMapping("/rectifications")
    public ApiResponse<List<Map<String, Object>>> rectifications() {
        return ApiResponse.success(repository.rectifications());
    }

    @PostMapping("/rectifications/{id}/feedback")
    public ApiResponse<Map<String, Object>> feedback(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("整改反馈已提交", repository.feedbackRectification(id, body));
    }

    @GetMapping("/penalties")
    public ApiResponse<List<Map<String, Object>>> penalties() {
        return ApiResponse.success(repository.penalties());
    }

    @PostMapping("/penalties/{id}/statement")
    public ApiResponse<Map<String, Object>> statement(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("陈述申辩已提交", repository.submitStatement(id, body));
    }

    @GetMapping("/policies")
    public ApiResponse<List<Map<String, Object>>> policies(
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(repository.policies(keyword));
    }

    @GetMapping("/subsidies")
    public ApiResponse<List<Map<String, Object>>> subsidies() {
        return ApiResponse.success(repository.subsidies());
    }

    @PostMapping("/subsidies")
    public ApiResponse<Map<String, Object>> createSubsidy(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("项目申报已提交", repository.createSubsidy(body));
    }

    @GetMapping("/public/credit")
    public ApiResponse<Map<String, Object>> publicCredit(
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(repository.publicCredit(keyword));
    }

    @GetMapping("/public/trace/{code}")
    public ApiResponse<Map<String, Object>> trace(@PathVariable String code) {
        return ApiResponse.success(repository.trace(code));
    }

    @GetMapping("/public/samplings")
    public ApiResponse<List<Map<String, Object>>> samplings() {
        return ApiResponse.success(repository.samplings());
    }

    @GetMapping("/public/lists")
    public ApiResponse<Map<String, Object>> publicLists() {
        return ApiResponse.success(repository.publicLists());
    }

    /**
     * 公示信息。
     *
     * <p>这里只返回公开处罚公示：原来把"当前登录主体的证照"当公示返回，
     * 公示页是给别人看的，返回登录者自己的档案既不对也是泄露。主体自己的证照走 {@code /licenses}。</p>
     */
    @GetMapping("/public/publicity")
    public ApiResponse<Map<String, Object>> publicity() {
        return ApiResponse.success(repository.publicity());
    }

    @GetMapping("/complaints")
    public ApiResponse<List<Map<String, Object>>> complaints() {
        return ApiResponse.success(repository.complaints());
    }

    @PostMapping("/complaints")
    public ApiResponse<Map<String, Object>> createComplaint(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("举报线索已提交", repository.createComplaint(body));
    }

    /** 收件箱：只返回发给当前监管主体的消息（原来按 user_type 一把捞，所有主体共用一个收件箱）。 */
    @GetMapping("/messages")
    public ApiResponse<List<Map<String, Object>>> messages() {
        return ApiResponse.success(repository.messages());
    }

    @PostMapping("/messages/read-all")
    public ApiResponse<Map<String, Object>> readAll() {
        return ApiResponse.success(repository.readAll());
    }

    /** 主体端只看与自己档案相关的执法留痕；全站日志在运营端。 */
    @GetMapping("/op-logs")
    public ApiResponse<List<Map<String, Object>>> logs() {
        return ApiResponse.success(repository.logs());
    }
}
