package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Supplier;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 供应商入驻审核通过后，调用平台侧开通业务身份与供货能力。
 *
 * <p>S2B2C 库只持有入驻档案；业务身份（{@code platform_identity_application}）与
 * 主体绑定（{@code platform_user_merchant}）属平台域，必须由平台统一落库，
 * 能力判定也继续走平台的 CapabilityFacade，避免两边口径分叉。</p>
 *
 * <p>调用使用服务间密钥（{@code X-Internal-Token}）：审核动作发生在运营端，
 * 申请人本人并不在场，不能依赖申请人的登录令牌。</p>
 */
@Service
public class SupplierOnboardingGrantService {

    @Value("${services.platform.url:http://localhost:8093}")
    private String platformUrl;

    @Value("${agri.capability.internal-token:agri-internal-dev}")
    private String internalToken;

    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    public SupplierOnboardingGrantService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * 开通供应商的业务身份 + 供货能力。
     *
     * @return 平台返回的开通结果（merchantId / identityType / capabilityGranted 等）
     * @throws IllegalStateException 平台拒绝或不可达（审核动作必须据此失败，不能"审核通过了但能力没开"）
     */
    public Map<String, Object> grant(Supplier supplier) {
        if (supplier == null || supplier.getUserId() == null) {
            throw new IllegalStateException("该入驻申请没有绑定平台账号，无法开通业务身份");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("userId", supplier.getUserId());
        body.put("marketId", 1);
        body.put("companyName", supplier.getCompanyName());
        body.put("creditCode", supplier.getCreditCode());
        body.put("contactName", supplier.getLegalName());
        body.put("contactPhone", supplier.getContactPhone());
        // 商城供应商业务身份（S2B2C 供货不占用交易域的批发/零售身份）
        body.put("identityType", "mall_supplier");
        try {
            HttpRequest request = HttpRequest.newBuilder(
                            URI.create(platformUrl + "/api/v1/internal/supplier-onboarding/grant"))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .header("X-Internal-Token", internalToken)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new IllegalStateException("开通受理失败（平台返回 " + response.statusCode() + "）");
            }
            JsonNode root = objectMapper.readTree(response.body());
            if (root.path("code").asInt(-1) != 0) {
                throw new IllegalStateException(root.path("message").asText("开通受理失败"));
            }
            JsonNode data = root.path("data");
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("merchantId", data.path("merchantId").asLong());
            result.put("identityType", data.path("identityType").asText(""));
            result.put("identityApplicationId", data.path("identityApplicationId").asLong());
            result.put("capabilityGranted", data.path("capabilityGranted").asBoolean(false));
            result.put("capabilityReason", data.path("capabilityReason").asText(""));
            if (!Boolean.TRUE.equals(result.get("capabilityGranted"))) {
                throw new IllegalStateException("业务身份已写入，但供货能力仍未开通："
                        + (result.get("capabilityReason") == null ? "" : result.get("capabilityReason")));
            }
            return result;
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("平台认证中心不可达，暂时无法开通业务身份：" + e.getMessage());
        }
    }
}
