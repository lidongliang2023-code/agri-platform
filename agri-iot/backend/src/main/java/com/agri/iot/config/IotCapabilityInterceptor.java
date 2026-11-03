package com.agri.iot.config;

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
 * 物联网写接口的能力校验。
 *
 * <p>IoT 后端已经有 RBAC（平台令牌 + iot:read/write），这里再加一层"业务能力"：
 * 设备、地块、场景、自动化规则都属于经营主体的生产资产，没加入主体的账号不应写入。
 * 判定仍归核心平台（{@code production.manage}），通过内部接口完成。</p>
 *
 * <p>只拦写方法，且排除 {@code /api/iot/data/**} —— 那是设备/网关上报的遥测数据，
 * 走的是设备侧凭据，不是用户动作。</p>
 */
@Component
public class IotCapabilityInterceptor implements HandlerInterceptor {

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
        if (request.getRequestURI().startsWith("/api/iot/data")) {
            return true;
        }
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return reject(response, HttpServletResponse.SC_UNAUTHORIZED, 401, "请先登录后再维护物联网数据");
        }
        JsonNode data;
        try {
            HttpRequest checkRequest = HttpRequest.newBuilder(URI.create(checkUrl))
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .header("Authorization", authorization)
                    .header("X-Internal-Token", internalToken)
                    .POST(HttpRequest.BodyPublishers.ofString("{\"code\":\"production.manage\"}"))
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
                reason.isEmpty() ? "当前账号未加入经营主体，无法维护物联网数据" : reason);
    }

    private boolean reject(HttpServletResponse response, int status, int code, String message) throws Exception {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":" + code + ",\"message\":\"" + message + "\",\"data\":null}");
        return false;
    }
}
