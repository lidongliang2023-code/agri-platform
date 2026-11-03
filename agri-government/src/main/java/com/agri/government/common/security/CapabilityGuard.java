package com.agri.government.common.security;

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

/** 政府域能力校验：把入站令牌转发给核心平台判定（gov.oversight = 审核通过的政府人员身份）。 */
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

    public void require(String authorization, String capabilityCode, String action) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录后再" + action);
        }
        JsonNode data;
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(checkUrl))
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .header("Authorization", authorization)
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
                reason.isEmpty() ? "需要开通「政府人员」业务身份后才能执行该操作" : reason);
    }
}
