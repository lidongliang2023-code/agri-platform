package com.agri.service.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.common.result.ApiResponse;
import com.agri.service.repository.ServiceRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/service")
@OperatorOnly("service:consumer")
public class ServiceController {

    private final ServiceRepository repository;

    public ServiceController(ServiceRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.success(repository.overview());
    }

    /** 前端可用的枚举字典（状态词表统一由后端给，避免各端各写一套中文常量）。 */
    @GetMapping("/dictionaries")
    public ApiResponse<Map<String, Object>> dictionaries() {
        return ApiResponse.success(repository.dictionaries());
    }

    @GetMapping("/experts")
    public ApiResponse<List<Map<String, Object>>> experts(@RequestParam(required = false) String category) {
        return ApiResponse.success(repository.experts(category));
    }

    @GetMapping("/resources")
    public ApiResponse<List<Map<String, Object>>> resources(@RequestParam(required = false) String type) {
        return ApiResponse.success(repository.resources(type));
    }

    @PostMapping("/resources")
    public ApiResponse<Map<String, Object>> createResource(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("资源信息已发布", repository.createResource(body));
    }

    @GetMapping("/favorites")
    public ApiResponse<List<Map<String, Object>>> favorites() {
        return ApiResponse.success(repository.favorites());
    }

    @PostMapping("/favorites/{providerId}/toggle")
    public ApiResponse<Map<String, Object>> toggleFavorite(@PathVariable long providerId) {
        return ApiResponse.success("收藏状态已更新", repository.toggleFavorite(providerId));
    }

    @GetMapping("/providers")
    public ApiResponse<List<Map<String, Object>>> providers(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String sort) {
        return ApiResponse.success(repository.providers(category, keyword, sort));
    }

    @GetMapping("/providers/{id}")
    public ApiResponse<Map<String, Object>> provider(@PathVariable long id) {
        return ApiResponse.success(repository.provider(id));
    }

    @PostMapping("/providers/apply")
    public ApiResponse<Map<String, Object>> applyProvider(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("入驻申请已提交", repository.createProvider(body));
    }

    @GetMapping("/orders")
    public ApiResponse<List<Map<String, Object>>> orders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(repository.orders(status, keyword));
    }

    @GetMapping("/orders/{id}")
    public ApiResponse<Map<String, Object>> order(@PathVariable long id) {
        return ApiResponse.success(repository.order(id));
    }

    @PostMapping("/orders")
    public ApiResponse<Map<String, Object>> createOrder(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("预约下单成功", repository.createOrder(body));
    }

    @PatchMapping("/orders/{id}")
    public ApiResponse<Map<String, Object>> updateOrder(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.updateOrder(id, body));
    }

    /**
     * 微信小程序与部分原生容器不支持 PATCH；保留同一语义的 PUT 入口，避免跨端协议分叉。
     */
    @PutMapping("/orders/{id}")
    public ApiResponse<Map<String, Object>> updateOrderPut(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.updateOrder(id, body));
    }

    @PostMapping("/orders/{id}/review")
    public ApiResponse<Map<String, Object>> reviewOrder(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("评价已提交", repository.reviewOrder(id, body));
    }

    @GetMapping("/demands")
    public ApiResponse<List<Map<String, Object>>> demands() {
        return ApiResponse.success(repository.demands());
    }

    /** 我发布的需求：含指派给谁与完整联系方式（大厅列表里是脱敏的）。 */
    @GetMapping("/demands/mine")
    public ApiResponse<List<Map<String, Object>>> myDemands() {
        return ApiResponse.success(repository.myDemands());
    }

    @PostMapping("/demands")
    public ApiResponse<Map<String, Object>> createDemand(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("需求已发布，AI 正在匹配服务商", repository.createDemand(body));
    }

    @GetMapping("/policies")
    public ApiResponse<List<Map<String, Object>>> policies(
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(repository.policies(keyword));
    }

    @GetMapping("/policies/applications")
    public ApiResponse<List<Map<String, Object>>> policyApplications() {
        return ApiResponse.success(repository.policyApplications());
    }

    @PostMapping("/policies/applications")
    public ApiResponse<Map<String, Object>> applyPolicy(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("申报已提交", repository.applyPolicy(body));
    }

    @GetMapping("/insurance/products")
    public ApiResponse<List<Map<String, Object>>> insuranceProducts() {
        return ApiResponse.success(repository.insuranceProducts());
    }

    @GetMapping("/insurance/policies")
    public ApiResponse<List<Map<String, Object>>> insurancePolicies() {
        return ApiResponse.success(repository.insurancePolicies());
    }

    @GetMapping("/insurance/claims")
    public ApiResponse<List<Map<String, Object>>> insuranceClaims() {
        return ApiResponse.success(repository.insuranceClaims());
    }

    @PostMapping("/insurance/policies")
    public ApiResponse<Map<String, Object>> insure(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("投保成功", repository.insure(body));
    }

    @PostMapping("/insurance/claims")
    public ApiResponse<Map<String, Object>> createClaim(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("报案已提交，查勘员将在 24 小时内联系您", repository.createClaim(body));
    }

    @GetMapping("/courses")
    public ApiResponse<List<Map<String, Object>>> courses() {
        return ApiResponse.success(repository.courses());
    }

    @PostMapping("/courses/{id}/enroll")
    public ApiResponse<Map<String, Object>> enroll(@PathVariable long id) {
        return ApiResponse.success("已加入学习", repository.enrollCourse(id));
    }

    /** 学习进度由服务端推进；到 100% 才签发结业证书。 */
    @PatchMapping("/courses/{id}/progress")
    public ApiResponse<Map<String, Object>> progress(@PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("学习进度已更新", repository.updateProgress(id, body));
    }

    @PutMapping("/courses/{id}/note")
    public ApiResponse<Map<String, Object>> note(@PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("课堂笔记已保存", repository.saveNote(id, body));
    }

    @GetMapping("/enrollments")
    public ApiResponse<List<Map<String, Object>>> enrollments() {
        return ApiResponse.success(repository.enrollments());
    }

    @GetMapping("/certificates")
    public ApiResponse<List<Map<String, Object>>> certificates() {
        return ApiResponse.success(repository.certificates());
    }

    @GetMapping("/consultations")
    public ApiResponse<List<Map<String, Object>>> consultations() {
        return ApiResponse.success(repository.consultations());
    }

    @PostMapping("/consultations")
    public ApiResponse<Map<String, Object>> createConsultation(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("问诊已提交", repository.createConsultation(body));
    }

    @PostMapping("/ai/diagnose")
    public ApiResponse<Map<String, Object>> diagnose(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.diagnose(body));
    }

    @GetMapping("/messages")
    public ApiResponse<List<Map<String, Object>>> messages() {
        return ApiResponse.success(repository.messages());
    }

    @PostMapping("/messages/read-all")
    public ApiResponse<Map<String, Object>> readAllMessages() {
        return ApiResponse.success(repository.markMessagesRead());
    }

    @GetMapping("/complaints")
    public ApiResponse<List<Map<String, Object>>> complaints() {
        return ApiResponse.success(repository.complaints());
    }

    @PostMapping("/complaints")
    public ApiResponse<Map<String, Object>> createComplaint(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("投诉工单已创建", repository.createComplaint(body));
    }
}
