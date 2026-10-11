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
    private Map<String, List<String>> clients = new LinkedHashMap<>(Map.of(
            "prod", List.of("http://localhost/", "http://127.0.0.1/", "http://localhost:5173/", "http://prod.agri.local/"),
            "mdm", List.of("http://localhost:8080/", "http://mdm.agri.local/"),
            "finance", List.of("http://localhost:8081/", "http://finance.agri.local/")));

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
