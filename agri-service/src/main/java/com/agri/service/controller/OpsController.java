package com.agri.service.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.common.result.ApiResponse;
import com.agri.service.repository.OpsRepository;
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
@OperatorOnly("service:admin")
public class OpsController {

    private final OpsRepository repository;

    public OpsController(OpsRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/ops/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.success(repository.overview());
    }

    @GetMapping("/ops/providers")
    public ApiResponse<List<Map<String, Object>>> providers(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(repository.providers(status, keyword));
    }

    @GetMapping("/ops/providers/{id}")
    public ApiResponse<Map<String, Object>> provider(@PathVariable long id) {
        return ApiResponse.success(repository.provider(id));
    }

    @PostMapping("/ops/providers/{id}/review")
    public ApiResponse<Map<String, Object>> reviewProvider(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("服务商审核状态已更新", repository.reviewProvider(id, body));
    }

    /**
     * 服务商档案 ↔ 平台经营主体绑定。
     *
     * <p>没有这条绑定，服务商账号登录后工作台无法确认"我代表哪家服务商"，
     * 接单就会落到某个写死的档案上。</p>
     */
    @PutMapping("/ops/providers/{id}/merchant-binding")
    public ApiResponse<Map<String, Object>> bindMerchant(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("服务商与平台经营主体绑定已更新",
                repository.bindMerchant(id, body.get("merchantId")));
    }

    @GetMapping("/ops/service-items")
    public ApiResponse<List<Map<String, Object>>> serviceItems(
            @RequestParam(required = false) String auditStatus,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(repository.serviceItems(auditStatus, keyword));
    }

    @PostMapping("/ops/service-items/{id}/review")
    public ApiResponse<Map<String, Object>> reviewServiceItem(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("服务商品审核结果已保存", repository.reviewServiceItem(id, body));
    }

    @GetMapping("/ops/orders")
    public ApiResponse<List<Map<String, Object>>> orders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(repository.orders(status, keyword));
    }

    @PostMapping("/ops/orders/{id}/dispatch")
    public ApiResponse<Map<String, Object>> dispatchOrder(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("派单成功", repository.dispatchOrder(id, body));
    }

    @GetMapping("/ops/dispatch-demands")
    public ApiResponse<List<Map<String, Object>>> dispatchDemands() {
        return ApiResponse.success(repository.dispatchDemands());
    }

    @PostMapping("/ops/dispatch-demands/{id}/assign")
    public ApiResponse<Map<String, Object>> assignDemand(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("需求已指派并生成服务工单", repository.assignDemand(id, body));
    }

    @GetMapping("/ops/complaints")
    public ApiResponse<List<Map<String, Object>>> complaints() {
        return ApiResponse.success(repository.complaints());
    }

    @PostMapping("/ops/complaints/{id}/resolve")
    public ApiResponse<Map<String, Object>> resolveComplaint(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("投诉工单已处理", repository.resolveComplaint(id, body));
    }

    @GetMapping("/ops/policy-applications")
    public ApiResponse<List<Map<String, Object>>> policyApplications() {
        return ApiResponse.success(repository.policyApplications());
    }

    @PostMapping("/ops/policy-applications/{id}/review")
    public ApiResponse<Map<String, Object>> reviewPolicy(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("政策申报审核状态已更新", repository.reviewPolicy(id, body));
    }

    @GetMapping("/ops/insurance-claims")
    public ApiResponse<List<Map<String, Object>>> claims() {
        return ApiResponse.success(repository.claims());
    }

    @PostMapping("/ops/insurance-claims/{id}/review")
    public ApiResponse<Map<String, Object>> reviewClaim(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("理赔进度已更新", repository.reviewClaim(id, body));
    }

    @GetMapping("/ops/settlements")
    public ApiResponse<List<Map<String, Object>>> settlements() {
        return ApiResponse.success(repository.settlements());
    }

    @PostMapping("/ops/settlements/{id}/review")
    public ApiResponse<Map<String, Object>> reviewSettlement(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("结算批次已复核", repository.reviewSettlement(id, body));
    }

    @GetMapping("/ops/campaigns")
    public ApiResponse<List<Map<String, Object>>> campaigns() {
        return ApiResponse.success(repository.campaigns());
    }

    @PatchMapping("/ops/campaigns/{id}")
    public ApiResponse<Map<String, Object>> updateCampaign(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.updateCampaign(id, body));
    }

    @GetMapping("/ops/quality-alerts")
    public ApiResponse<List<Map<String, Object>>> qualityAlerts() {
        return ApiResponse.success(repository.qualityAlerts());
    }

    @PostMapping("/ops/quality-alerts/{id}/resolve")
    public ApiResponse<Map<String, Object>> resolveQualityAlert(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("质量预警已处理", repository.resolveQualityAlert(id, body));
    }

    @GetMapping("/ops/strategies")
    public ApiResponse<List<Map<String, Object>>> strategies() {
        return ApiResponse.success(repository.strategies());
    }

    @PostMapping("/ops/strategies")
    public ApiResponse<List<Map<String, Object>>> updateStrategy(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("策略参数已发布", repository.updateStrategy(body));
    }

    @GetMapping("/ops/team")
    public ApiResponse<List<Map<String, Object>>> team() {
        return ApiResponse.success(repository.team());
    }

    @GetMapping("/ops/logs")
    public ApiResponse<List<Map<String, Object>>> logs() {
        return ApiResponse.success(repository.logs());
    }

    @GetMapping("/ops/reports")
    public ApiResponse<Map<String, Object>> report() {
        return ApiResponse.success(repository.report());
    }

}
