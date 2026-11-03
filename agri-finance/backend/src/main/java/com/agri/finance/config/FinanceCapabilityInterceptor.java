package com.agri.finance.config;

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

/**
 * 融资申请的能力前置校验（跨进程调用平台内部接口）。
 *
 * <p>金融是独立部署的子系统，拿不到平台的 {@code CapabilityFacade}，但"是否具备融资能力"
 * 必须由平台判定 —— 这里把入站令牌原样带给核心平台，由平台按
 * {@code finance.apply}（= 经营主体认证通过）判定，避免金融自己抄一份口径。</p>
 *
 * <p>失败策略：<b>fail closed</b>。核心平台不可达时返回 503 并说明原因，而不是放行 ——
 * 金融是资金动作，宁可暂时不可用，也不能在校验缺失时放过去。</p>
 */
@Component
public class FinanceCapabilityInterceptor implements HandlerInterceptor {

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
        if (CorsUtils.isPreFlightRequest(request) || !"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return reject(response, HttpServletResponse.SC_UNAUTHORIZED, 401, "请先登录后再申请融资");
        }
        JsonNode data;
        try {
            HttpRequest checkRequest = HttpRequest.newBuilder(URI.create(checkUrl))
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .header("Authorization", authorization)
                    .header("X-Internal-Token", internalToken)
                    .POST(HttpRequest.BodyPublishers.ofString("{\"code\":\"finance.apply\"}"))
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
            // 核心平台不可达：资金动作宁可拒绝，也不能在没校验的情况下放行
            return reject(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, 503,
                    "能力校验服务不可用，请稍后重试");
        }
        if (data.path("granted").asBoolean(false)) {
            return true;
        }
        String reason = data.path("reason").asText("");
        return reject(response, HttpServletResponse.SC_FORBIDDEN, 403,
                reason.isEmpty() ? "当前主体未通过经营主体认证，无法申请融资" : reason);
    }

    private boolean reject(HttpServletResponse response, int status, int code, String message) throws Exception {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":" + code + ",\"message\":\"" + message + "\",\"data\":\"\"}");
        return false;
    }
}
