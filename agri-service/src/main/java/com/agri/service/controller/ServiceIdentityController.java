package com.agri.service.controller;

import com.agri.common.result.ApiResponse;
import com.agri.service.security.ServiceIdentityService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 当前登录者在综合服务侧的身份卡。
 *
 * <p>三个入口原先各自"认人"的方式都不对：用户端把身份交给前端自报（下单时
 * {@code contactName} 缺省"平台用户"）、服务商工作台读 URL 上的 {@code providerId}
 * （还带 {@code defaultValue = "1"} 兜底）、运营端把操作人写成代码常量"王运营"。
 * 页面要显示"我现在是谁"就只能把这些常量再抄一遍。这里给出唯一解析入口，前端只读不算。</p>
 */
@RestController
@RequestMapping("/api/v1/service")
public class ServiceIdentityController {

    private final ServiceIdentityService identity;

    public ServiceIdentityController(ServiceIdentityService identity) {
        this.identity = identity;
    }

    @GetMapping("/identity")
    public ApiResponse<Map<String, Object>> identity() {
        Map<String, Object> data = new LinkedHashMap<>();
        try {
            data.put("merchantId", identity.currentMerchantId());
            data.put("merchantName", identity.currentMerchantName());
            data.put("merchantError", null);
        } catch (Exception e) {
            data.put("merchantId", null);
            data.put("merchantName", null);
            data.put("merchantError", e.getMessage());
        }
        Long providerId = null;
        String providerName = null;
        String providerError;
        try {
            providerId = identity.currentProviderId();
            Map<String, Object> provider = identity.currentProviderRow(providerId);
            providerName = String.valueOf(provider.get("name"));
            data.put("providerCategory", provider.get("category"));
            data.put("providerStatus", provider.get("status"));
            data.put("providerRegion", provider.get("region"));
            providerError = null;
        } catch (Exception e) {
            providerError = e.getMessage();
        }
        data.put("providerId", providerId == null ? null : String.valueOf(providerId));
        data.put("providerName", providerName);
        data.put("providerError", providerError);
        data.put("userId", identity.currentUserId() == null ? null : String.valueOf(identity.currentUserId()));
        data.put("operatorName", identity.operatorName());
        data.put("operatorRole", identity.operatorRole());
        Map<String, Boolean> roles = new LinkedHashMap<>();
        roles.put("consumer", identity.hasPermission("service:consumer"));
        roles.put("provider", identity.hasPermission("service:provider"));
        roles.put("admin", identity.isOps());
        data.put("roles", roles);
        return ApiResponse.success(data);
    }
}
