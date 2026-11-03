package com.agri.service.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.common.result.ApiResponse;
import com.agri.service.repository.OpsRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 综合服务服务商移动工作台。
 *
 * <p>与平台运营端的 {@code /ops/**} 分开鉴权：服务商只拥有 {@code service:provider}，
 * 不能借工作台账号进入审核、结算或运营接口。</p>
 *
 * <p>路径里<b>不再出现 providerId</b>：原先 {@code GET ?providerId=1}（还带默认值）与
 * {@code /provider/{providerId}/...} 都由调用方自报身份，换个数就能替别家接单、
 * 给别家的工单报进度。现在一律从访问令牌解析到 {@code service_provider.merchant_id}。</p>
 */
@RestController
@RequestMapping("/api/v1/service/mobile/workbench")
@OperatorOnly("service:provider")
public class ProviderWorkbenchController {

    private final OpsRepository repository;

    public ProviderWorkbenchController(OpsRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ApiResponse<Map<String, Object>> workbench() {
        return ApiResponse.success(repository.mobileWorkbench());
    }

    @PostMapping("/demands/{demandId}/accept")
    public ApiResponse<Map<String, Object>> acceptDemand(@PathVariable long demandId) {
        return ApiResponse.success("抢单成功，请及时联系需求方", repository.acceptDemand(demandId));
    }

    @PostMapping("/orders/{orderId}/progress")
    public ApiResponse<Map<String, Object>> reportProgress(
            @PathVariable long orderId,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success("服务进度已上报", repository.reportProgress(orderId, body));
    }
}
