package com.agri.s2b2c.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * S2B2C 业务能力校验：把当前请求的令牌转发给核心平台判定。
 *
 * <p>能力码：`s2b2c.consumer`（下单）、`s2b2c.supplier`（上架/改商品）。
 * 失败 fail closed：平台不可达 503，能力不具备 403 并带平台给的原因。</p>
 */
@Service
public class CapabilityGuard {

    @Value("${agri.capability.check-url:http://localhost:8093/api/v1/internal/capability-check}")
    private String checkUrl;

    @Value("${agri.capability.internal-token:agri-internal-dev}")
    private String internalToken;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    /** 只读查询能力状态，供入驻/工作台页面展示，不抛异常。 */
    public java.util.Map<String, Object> check(String capabilityCode) {
        java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();
        String token = SecurityUtils.getToken();
        if (token == null) {
            result.put("granted", false);
            result.put("reason", "请先登录后再操作");
            return result;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(checkUrl))
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + token)
                    .header("X-Internal-Token", internalToken)
                    .POST(HttpRequest.BodyPublishers.ofString("{\"code\":\"" + capabilityCode + "\"}"))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                result.put("granted", false);
                result.put("reason", "能力校验服务返回异常（" + response.statusCode() + "）");
                return result;
            }
            JsonNode root = objectMapper.readTree(response.body());
            if (root.path("code").asInt(-1) != 0) {
                result.put("granted", false);
                result.put("reason", root.path("message").asText("能力校验失败"));
                return result;
            }
            JsonNode data = root.path("data");
            result.put("granted", data.path("granted").asBoolean(false));
            result.put("reason", data.path("reason").asText(""));
        } catch (Exception e) {
            result.put("granted", false);
            result.put("reason", "能力校验服务暂不可用");
        }
        return result;
    }

    public void require(String capabilityCode, String action) {
        String token = SecurityUtils.getToken();
        if (token == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录后再" + action);
        }
        JsonNode data;
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(checkUrl))
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + token)
                    .header("X-Internal-Token", internalToken)
                    .POST(HttpRequest.BodyPublishers.ofString("{\"code\":\"" + capabilityCode + "\"}"))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "能力校验服务返回异常（" + response.statusCode() + "），请稍后重试");
            }
            JsonNode root = objectMapper.readTree(response.body());
            if (root.path("code").asInt(-1) != 0) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        root.path("message").asText("能力校验失败，请稍后重试"));
            }
            data = root.path("data");
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "能力校验服务不可用，请稍后重试");
        }
        if (data.path("granted").asBoolean(false)) {
            return;
        }
        String reason = data.path("reason").asText("");
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                reason.isEmpty() ? "当前账号不具备该操作所需能力" : reason);
    }
}
