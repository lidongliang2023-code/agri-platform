package com.agri.service.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;

/**
 * 服务商工作台的能力校验。
 *
 * <p>服务域已有 RBAC（platform.rbac：/api/** 需要令牌 + service:read/write），
 * 这里再加业务能力：抢单、上报服务进度属于"以服务商身份履约"，要求
 * {@code service.provider}（= 审核通过的服务商业务身份）。</p>
 *
 * <p>只覆盖服务商工作台的写方法；需求方下单、政策申报、课程报名等不动 ——
 * 它们没有对应的业务身份语义，硬套会让普通用户用不了。</p>
 */
@Component
public class ServiceCapabilityInterceptor implements HandlerInterceptor {

    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    @Value("${agri.capability.check-url:http://localhost:8093/api/v1/internal/capability-check}")
    private String checkUrl;

    @Value("${agri.capability.internal-token:agri-internal-dev}")
    private String internalToken;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (CorsUtils.isPreFlightRequest(request) || !WRITE_METHODS.contains(request.getMethod())) {
            return true;
        }
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return reject(response, HttpServletResponse.SC_UNAUTHORIZED, 401, "请先登录后再操作服务商工作台");
        }
        JsonNode data;
        try {
            HttpRequest checkRequest = HttpRequest.newBuilder(URI.create(checkUrl))
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .header("Authorization", authorization)
                    .header("X-Internal-Token", internalToken)
                    .POST(HttpRequest.BodyPublishers.ofString("{\"code\":\"service.provider\"}"))
                    .build();
            HttpResponse<String> checkResponse = httpClient.send(checkRequest, HttpResponse.BodyHandlers.ofString());
            if (checkResponse.statusCode() != 200) {
                return reject(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, 503,
                        "能力校验服务返回异常（" + checkResponse.statusCode() + "），请稍后重试");
            }
            JsonNode root = objectMapper.readTree(checkResponse.body());
            if (root.path("code").asInt(-1) != 0) {
                return reject(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, 503,
                        root.path("message").asText("能力校验失败，请稍后重试"));
            }
            data = root.path("data");
        } catch (Exception e) {
            return reject(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, 503,
                    "能力校验服务不可用，请稍后重试");
        }
        if (data.path("granted").asBoolean(false)) {
            return true;
        }
        String reason = data.path("reason").asText("");
        return reject(response, HttpServletResponse.SC_FORBIDDEN, 403,
                reason.isEmpty() ? "需要开通「服务商」业务身份后才能接单/上报进度" : reason);
    }

    private boolean reject(HttpServletResponse response, int status, int code, String message) throws Exception {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":" + code + ",\"message\":\"" + message + "\",\"data\":null}");
        return false;
    }
}
