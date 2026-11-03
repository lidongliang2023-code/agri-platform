package com.agri.platform.internal.sso;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// SSO 中心配置（V2.0 第 5.1 / 5.2 节）。
//
// client 注册表是授权码流程的第一道防线：不校验 redirect_uri 的话，任何站点都能构造授权请求
// 把签发的 code 收到自己名下（开放重定向 + 授权码拦截），拿到 code 就等于拿到该用户的会话。
// 所以这里匹配的是"注册在案的前缀"，而不是"看起来像本站"。
//
// 默认值只覆盖本地开发口径；生产用 application.yml 的 agri.sso.clients 覆盖。
// SSO 中心将来拆成独立服务时，本配置应改为注册表（数据库 + 管理接口）。
@Data
@Component
@ConfigurationProperties(prefix = "agri.sso")
public class SsoProperties {

    /** client_id → 允许的 redirect_uri 前缀（前缀匹配，末尾要带路径分隔语义） */
    private Map<String, List<String>> clients = defaultClients();

    private static Map<String, List<String>> defaultClients() {
        Map<String, List<String>> result = new LinkedHashMap<>();
        result.put("prod", List.of("http://localhost/", "http://127.0.0.1/", "http://localhost:5173/", "http://prod.agri.local/"));
        result.put("mdm", List.of("http://localhost:8080/", "http://mdm.agri.local/"));
        result.put("finance", List.of(
                "http://localhost:8081/", "http://127.0.0.1:8081/",
                "http://localhost:5176/", "http://127.0.0.1:5176/",
                "http://finance.agri.local/"));
        // 交易撮合模块（agri-trade）：网关虚拟主机在 8086，前端 dev server 在 3002。
        result.put("trade", List.of(
                "http://localhost:8086/", "http://127.0.0.1:8086/",
                "http://localhost:3002/", "http://127.0.0.1:3002/",
                "http://trade.agri.local/"));
        // 官网门户仅用于统一登出后的安全回跳（不参与授权码登录）。
        result.put("portal", List.of("http://localhost:8098/portal/", "http://127.0.0.1:8098/portal/"));
        result.put("iot", List.of("http://localhost:8101/", "http://127.0.0.1:8101/", "http://iot.agri.local/"));
        result.put("iot-admin", List.of("http://localhost:8102/", "http://127.0.0.1:8102/", "http://iot-admin.agri.local/"));
        result.put("service", List.of(
                "http://localhost:8105/", "http://127.0.0.1:8105/",
                "http://localhost:8106/", "http://127.0.0.1:8106/",
                "http://localhost:5194/", "http://127.0.0.1:5194/",
                "http://localhost:5195/", "http://127.0.0.1:5195/",
                "http://service.agri.local/", "http://service-mobile.agri.local/"));
        result.put("service-ops", List.of(
                "http://localhost:8107/", "http://127.0.0.1:8107/",
                "http://localhost:5196/", "http://127.0.0.1:5196/",
                "http://service-ops.agri.local/"));
        result.put("gov", List.of(
                "http://localhost:8108/", "http://127.0.0.1:8108/",
                "http://localhost:8109/", "http://127.0.0.1:8109/",
                "http://localhost:5181/", "http://127.0.0.1:5181/",
                "http://localhost:5182/", "http://127.0.0.1:5182/",
                "http://gov.agri.local/", "http://gov-mobile.agri.local/"));
        result.put("gov-ops", List.of(
                "http://localhost:8110/", "http://127.0.0.1:8110/",
                "http://localhost:5183/", "http://127.0.0.1:5183/",
                "http://gov-ops.agri.local/"));
        // S2B2C 四个角色端共用平台用户，但保留独立 client_id，避免跨角色授权回跳。
        result.put("mall-consumer", List.of(
                "http://localhost:8082/", "http://127.0.0.1:8082/",
                "http://localhost:8182/", "http://127.0.0.1:8182/",
                "http://localhost:3000/", "http://mall-consumer.agri.local/"));
        result.put("mall-supplier", List.of(
                "http://localhost:8084/", "http://127.0.0.1:8084/",
                "http://localhost:8183/", "http://127.0.0.1:8183/",
                "http://localhost:3001/", "http://mall-supplier.agri.local/"));
        result.put("mall-channel", List.of(
                "http://localhost:8085/", "http://127.0.0.1:8085/",
                "http://localhost:8184/", "http://127.0.0.1:8184/",
                "http://localhost:3002/", "http://mall-channel.agri.local/"));
        result.put("s2b2c-platform", List.of(
                "http://localhost:8103/", "http://127.0.0.1:8103/",
                "http://localhost:3003/", "http://s2b2c-platform.agri.local/"));
        // 信息资讯（agri-info）：用户端与运营端各一个 client_id，权限分别是 info:consumer / info:admin。
        // 用户端在网关 :8104 的 /info/ 下（dev :5197），运营端在 :8113 的 /info-ops/ 下（dev :5198）。
        // redirect_uri 取 origin + /sso/callback，不含 base 路径，所以这里登记站点根。
        // 移动端 H5 产物在 :8114（dev :5199），沿用 info client：同一账号体系，只是渲染端不同。
        result.put("info", List.of(
                "http://localhost:8104/", "http://127.0.0.1:8104/",
                "http://localhost:5197/", "http://127.0.0.1:5197/",
                "http://localhost:8114/", "http://127.0.0.1:8114/",
                "http://localhost:5199/", "http://127.0.0.1:5199/",
                "http://info.agri.local/"));
        result.put("info-ops", List.of(
                "http://localhost:8113/", "http://127.0.0.1:8113/",
                "http://localhost:5198/", "http://127.0.0.1:5198/",
                "http://info-ops.agri.local/"));
        // 用户中心运营端（agri-sso/ops）：网关 :8115，dev :5200。
        // 单独一个 client_id 的理由与 info-ops 相同 —— 它的准入权限是 uc:admin，
        // 和登录页（sso）共用会让"能进后台"与"能登录"混为一谈。
        result.put("user-center-ops", List.of(
                "http://localhost:8115/", "http://127.0.0.1:8115/",
                "http://localhost:5200/", "http://127.0.0.1:5200/",
                "http://user-center-ops.agri.local/"));
        return result;
    }

    /** 授权码有效期（秒）：一次性、短时效 —— 它是"凭证"，不是会话 */
    private long codeTtlSeconds = 60;

    /** SSO 全局会话有效期（小时）：凭它实现跨子系统免登 */
    private long sessionTtlHours = 8;

    /** SSO 会话 Cookie（sso 域，HttpOnly，JS 读不到） */
    private String sessionCookieName = "agri_sso_session";
    private String sessionCookiePath = "/";
    private boolean sessionCookieSecure = false;
    private String sessionCookieSameSite = "Lax";

    /** 未登录时跳转的登录页路径（同域，由网关把该路径交给 SSO 前端产物） */
    private String loginPath = "/login";
}
