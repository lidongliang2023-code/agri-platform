package com.agri.production.common.capability;

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
 * 生产域写接口的能力前置校验。
 *
 * <p>生产后端是独立部署的服务，判定口径仍归核心平台：把入站令牌原样带给
 * `/api/v1/internal/capability-check`，由平台按 {@code production.manage}（已加入经营主体）判定。</p>
 *
 * <p>只拦写方法；运营端 {@code /api/v1/production/admin/**} 与小程序 {@code /api/v1/production/mobile/**}
 * 各自有独立鉴权链路，不在这里改变行为。</p>
 */
@Component
public class ProductionApiCapabilityInterceptor implements HandlerInterceptor {

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
            return reject(response, HttpServletResponse.SC_UNAUTHORIZED, 401, "请先登录后再维护生产数据");
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
                reason.isEmpty() ? "当前账号未加入经营主体，无法维护生产数据" : reason);
    }

    private boolean reject(HttpServletResponse response, int status, int code, String message) throws Exception {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":" + code + ",\"message\":\"" + message + "\",\"data\":null}");
        return false;
    }
}
