package com.agri.government.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.common.result.ApiResponse;
import com.agri.government.repository.GovernmentOpsRepository;
import org.springframework.web.bind.annotation.GetMapping;
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
@RequestMapping("/api/v1/government")
@OperatorOnly("gov:admin")
public class GovernmentOpsController {
    private final GovernmentOpsRepository repository;

    public GovernmentOpsController(GovernmentOpsRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/ops/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.success(repository.overview());
    }

    @GetMapping("/ops/subjects")
    public ApiResponse<List<Map<String, Object>>> subjects(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String riskLevel) {
        return ApiResponse.success(repository.subjects(keyword, riskLevel));
    }

    /**
     * 监管档案 ↔ 平台经营主体绑定。
     *
     * <p>没绑定之前，主体端登录只会拿到"档案里没登记你的经营主体"。这条关系由运营显式建立，
     * 不按名字猜（同名不等于同一家）；传空即解除绑定。</p>
     */
    @PutMapping("/ops/subjects/{id}/merchant-binding")
    public ApiResponse<Map<String, Object>> bindMerchant(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("绑定关系已更新", repository.bindMerchant(id, body.get("merchantId")));
    }

    @GetMapping("/ops/rectifications")
    public ApiResponse<List<Map<String, Object>>> rectifications(@RequestParam(required = false) String status) {
        return ApiResponse.success(repository.rectifications(status));
    }

    /** 整改复核：主体反馈后由监管结案或退回，主体端的待办才会真的消掉。 */
    @PostMapping("/ops/rectifications/{id}/review")
    public ApiResponse<Map<String, Object>> reviewRectification(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("整改复核已生效", repository.reviewRectification(id, body));
    }

    @GetMapping("/ops/check-items")
    public ApiResponse<List<Map<String, Object>>> checkItems() {
        return ApiResponse.success(repository.checkItems());
    }

    @PostMapping("/ops/check-items")
    public ApiResponse<Map<String, Object>> createCheckItem(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("执法事项已新增", repository.saveCheckItem(body, null));
    }

    @PutMapping("/ops/check-items/{id}")
    public ApiResponse<Map<String, Object>> updateCheckItem(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("执法事项已更新", repository.saveCheckItem(body, id));
    }

    @PostMapping("/ops/check-items/{id}/toggle")
    public ApiResponse<Map<String, Object>> toggleCheckItem(
            @PathVariable long id, @RequestParam boolean active) {
        return ApiResponse.success(repository.toggleCheckItem(id, active));
    }

    @GetMapping("/ops/warnings")
    public ApiResponse<List<Map<String, Object>>> warnings(@RequestParam(required = false) String status) {
        return ApiResponse.success(repository.warnings(status));
    }

    @PostMapping("/ops/warnings/{id}/handle")
    public ApiResponse<Map<String, Object>> handleWarning(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("预警已分派", repository.handleWarning(id, body));
    }

    @GetMapping("/ops/tasks")
    public ApiResponse<List<Map<String, Object>>> tasks(@RequestParam(required = false) String status) {
        return ApiResponse.success(repository.tasks(status));
    }

    @PostMapping("/ops/tasks")
    public ApiResponse<Map<String, Object>> createTask(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("检查任务已创建", repository.createTask(body));
    }

    @GetMapping("/ops/cases")
    public ApiResponse<List<Map<String, Object>>> cases() {
        return ApiResponse.success(repository.cases());
    }

    @PostMapping("/ops/cases/{id}/advance")
    public ApiResponse<Map<String, Object>> advanceCase(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("案件阶段已更新", repository.advanceCase(id, body));
    }

    @GetMapping("/ops/repairs")
    public ApiResponse<List<Map<String, Object>>> repairs() {
        return ApiResponse.success(repository.repairs());
    }

    @PostMapping("/ops/repairs/{id}/review")
    public ApiResponse<Map<String, Object>> reviewRepair(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("信用修复审核完成", repository.reviewRepair(id, body));
    }

    @GetMapping("/ops/subsidies")
    public ApiResponse<List<Map<String, Object>>> subsidies() {
        return ApiResponse.success(repository.subsidies());
    }

    @PostMapping("/ops/subsidies/{id}/review")
    public ApiResponse<Map<String, Object>> reviewSubsidy(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("项目审核状态已更新", repository.reviewSubsidy(id, body));
    }

    @GetMapping("/ops/complaints")
    public ApiResponse<List<Map<String, Object>>> complaints() {
        return ApiResponse.success(repository.complaints());
    }

    @PostMapping("/ops/complaints/{id}/handle")
    public ApiResponse<Map<String, Object>> handleComplaint(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("举报已处理", repository.handleComplaint(id, body));
    }

    @GetMapping("/ops/samplings")
    public ApiResponse<List<Map<String, Object>>> samplings() {
        return ApiResponse.success(repository.samplings());
    }

    @PostMapping("/ops/samplings")
    public ApiResponse<Map<String, Object>> createSampling(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("抽样任务已创建", repository.createSampling(body));
    }

    @GetMapping("/ops/data-shares")
    public ApiResponse<List<Map<String, Object>>> dataShares() {
        return ApiResponse.success(repository.dataShares());
    }

    @PostMapping("/ops/data-shares/{id}/review")
    public ApiResponse<Map<String, Object>> reviewDataShare(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("共享授权已更新", repository.reviewDataShare(id, body));
    }

    @GetMapping("/ops/users")
    public ApiResponse<List<Map<String, Object>>> users() {
        return ApiResponse.success(repository.users());
    }

    /** 执法人员档案 ↔ 平台账号绑定（传空即解除）；移动执法端靠它把令牌解析成"我"。 */
    @PutMapping("/ops/users/{id}/platform-binding")
    public ApiResponse<Map<String, Object>> bindPlatformUser(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("执法账号绑定已更新",
                repository.bindPlatformUser(id, body.get("platformUserId")));
    }

    @GetMapping("/ops/logs")
    public ApiResponse<List<Map<String, Object>>> logs() {
        return ApiResponse.success(repository.logs());
    }

    @GetMapping("/ops/statistics")
    public ApiResponse<Map<String, Object>> statistics() {
        return ApiResponse.success(repository.statistics());
    }

}
