package com.agri.trade.common.capability;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Set;

/**
 * 交易域写接口的业务能力校验。
 *
 * <p>交易是独立部署的后端，能力判定归核心平台：把入站 Bearer 带给
 * `/api/v1/internal/capability-check`，由平台按已审核通过的业务身份判定。</p>
 *
 * <p><b>按动作选能力集合</b>：供货类（seller/product、product）要 SELL 集合，
 * 采购类（demand）要 BUY 集合，成交类（order/contract/negotiation/guarantee/…）任一交易能力即可。
 * 匹配查询（demand/{id}/match）、店铺互动等不按身份卡，直接放行。</p>
 *
 * <p><b>运营端不参与这道门</b>：{@code /api/trade/admin/**} 与标了 {@code @OperatorOnly}
 * 的接口是平台运营的动作（审核退款、核准赔付、冻结保证金…），准入由平台 RBAC 判定；
 * 再要求它们具备"批发商/农户"这类市场身份，运营就永远进不去自己的审核台。</p>
 *
 * <p>失败策略：核心平台不可达时 <b>fail closed</b>（503），不放行未校验的写操作。</p>
 */
@Component
public class TradeCapabilityInterceptor implements HandlerInterceptor {

    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    /** 供货类：批发商 / 农户 / 合作社管理员 */
    private static final List<String> SELL = List.of("trade.wholesale", "supply.farmer", "coop.manage");
    /** 采购类：批发商 / 零售商 */
    private static final List<String> BUY = List.of("trade.wholesale", "trade.retail");
    /** 成交类：任一交易身份 */
    private static final List<String> ANY_TRADE = List.of(
            "trade.wholesale", "trade.retail", "supply.farmer", "coop.manage");

    private static final String TRADE_HINT = "需要已开通交易类业务身份（批发商 / 零售商 / 农户 / 合作社管理员），"
            + "请先在用户中心「我的组织 → 业务身份」申请并通过审核";

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
        // 没落到任何控制器上的路径（含已下线的旧路由）交给 Spring 自己回 404 ——
        // 让能力闸门去回答"你没有业务身份"，等于替一个不存在的接口编造拒绝理由，
        // 也让点检脚本无法区分"路由已下线"与"路由在但你不该用"。
        if (!(handler instanceof HandlerMethod)
                || CorsUtils.isPreFlightRequest(request) || !WRITE_METHODS.contains(request.getMethod())) {
            return true;
        }
        // 运营动作不是市场参与动作：退款审核、赔付建单/核准/打款、保证金冻结这些都挂在
        // @OperatorOnly（或 /api/trade/admin/** 这段运营路径）上，准入由平台 RBAC 的
        // trade:read / trade:write 判定。以前这里对运营接口同样要"交易类业务身份"，
        // 于是运营点"核准赔付"会得到一句"请先在用户中心申请业务身份"——
        // 让平台运营去申请批发商身份，本身就说明这道门装错了地方。
        if (isOperatorEndpoint(request.getRequestURI(), handler)) {
            return true;
        }
        List<String> required = requiredCapabilities(request.getRequestURI());
        if (required == null) {
            return true;
        }
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return reject(response, HttpServletResponse.SC_UNAUTHORIZED, 401, "请先登录后再进行交易操作");
        }
        for (String code : required) {
            Boolean granted = check(authorization, code, response);
            if (granted == null) {
                return false;
            }
            if (granted) {
                return true;
            }
        }
        return reject(response, HttpServletResponse.SC_FORBIDDEN, 403, TRADE_HINT);
    }

    /** 运营端接口：按路径段（/api/trade/admin/）或 @OperatorOnly 标注识别。 */
    private static boolean isOperatorEndpoint(String uri, Object handler) {
        if (uri != null && uri.startsWith("/api/trade/admin/")) {
            return true;
        }
        if (handler instanceof HandlerMethod method) {
            return method.hasMethodAnnotation(com.agri.common.rbac.OperatorOnly.class)
                    || method.getBeanType().isAnnotationPresent(com.agri.common.rbac.OperatorOnly.class);
        }
        return false;
    }

    /** 按路径决定需要哪组能力；返回 null 表示不校验（评审、匹配、互动等） */
    private List<String> requiredCapabilities(String uri) {
        if (uri == null) {
            return null;
        }
        if (uri.startsWith("/api/trade/seller/product")) {
            return SELL;
        }
        // 商品审核是评审动作，不是交易身份动作 —— 但它现在只在运营端的
        // /api/trade/admin/product/{id}/audit 上（用户端那条无判权的已下线），
        // 所以这里不再为 /api/trade/product/** 留豁免口子。
        if (uri.startsWith("/api/trade/product")) {
            return SELL;
        }
        // 需求匹配是查询，不卡身份
        if (uri.startsWith("/api/trade/demand") && !uri.matches("^/api/trade/demand/\\d+/match$")) {
            return BUY;
        }
        for (String prefix : List.of("/api/trade/order", "/api/trade/contract", "/api/trade/negotiation",
                "/api/trade/guarantee", "/api/trade/compensation", "/api/trade/dispute",
                "/api/trade/invoice", "/api/trade/logistics", "/api/trade/evaluation")) {
            if (uri.startsWith(prefix)) {
                return ANY_TRADE;
            }
        }
        return null;
    }

    /** @return true/false 判定结果；null 表示校验服务异常（已写响应，调用方直接返回 false） */
    private Boolean check(String authorization, String code, HttpServletResponse response) throws Exception {
        try {
            HttpRequest checkRequest = HttpRequest.newBuilder(URI.create(checkUrl))
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .header("Authorization", authorization)
                    .header("X-Internal-Token", internalToken)
                    .POST(HttpRequest.BodyPublishers.ofString("{\"code\":\"" + code + "\"}"))
                    .build();
            HttpResponse<String> checkResponse = httpClient.send(checkRequest, HttpResponse.BodyHandlers.ofString());
            if (checkResponse.statusCode() != 200) {
                reject(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, 503,
                        "能力校验服务返回异常（" + checkResponse.statusCode() + "），请稍后重试");
                return null;
            }
            JsonNode root = objectMapper.readTree(checkResponse.body());
            if (root.path("code").asInt(-1) != 0) {
                reject(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, 503,
                        root.path("message").asText("能力校验失败，请稍后重试"));
                return null;
            }
            return root.path("data").path("granted").asBoolean(false);
        } catch (Exception e) {
            reject(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, 503, "能力校验服务不可用，请稍后重试");
            return null;
        }
    }

    private boolean reject(HttpServletResponse response, int status, int code, String message) throws Exception {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":" + code + ",\"message\":\"" + message + "\",\"data\":null}");
        return false;
    }
}
