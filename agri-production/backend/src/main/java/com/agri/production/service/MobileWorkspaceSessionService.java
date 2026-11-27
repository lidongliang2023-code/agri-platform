package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.*;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** 原生客户端到生产业务网页的一次性登录交接；不持久化凭据，不替代统一认证。 */
@Service
public class MobileWorkspaceSessionService {
    private record Ticket(String token, String target, long expiresAt) {}
    private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final String platform;
    public MobileWorkspaceSessionService(@Value("${services.platform.url:}") String platform) { this.platform = platform; }

    private Map<String,Object> identity(String token) {
        if (token == null || !token.startsWith("Bearer ") || token.length() > 12000)
            throw new BusinessException(401, "请先登录生产管理账号");
        if (platform == null || platform.isBlank()) throw new BusinessException(503, "统一认证服务地址未配置");
        try {
            var req = HttpRequest.newBuilder(URI.create(platform + "/api/v1/auth/me"))
                .header("Authorization", token).timeout(Duration.ofSeconds(6)).GET().build();
            var response = client.send(req, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 401 || response.statusCode() == 403) throw new BusinessException(401, "登录已失效，请重新登录");
            if (response.statusCode() != 200) throw new BusinessException(503, "统一认证服务暂不可用");
            Map<String,Object> body = mapper.readValue(response.body(), Map.class);
            if (!"0".equals(String.valueOf(body.get("code"))) || !(body.get("data") instanceof Map<?,?> user) || user.get("id") == null)
                throw new BusinessException(401, "无法核实登录账号");
            return (Map<String,Object>) user;
        } catch (BusinessException e) { throw e; }
        catch (Exception e) { throw new BusinessException(503, "登录身份核验暂时失败，请稍后重试"); }
    }
    private boolean ops(Map<String,Object> user) {
        return user.get("roles") instanceof Collection<?> roles && roles.stream().map(String::valueOf)
            .anyMatch(r -> r.equals("SUPER_ADMIN") || r.equals("MARKET_OPS") || r.endsWith("ADMIN") || r.endsWith("OPS"));
    }
    private String target(Object raw, Map<String,Object> user) {
        String value = Objects.toString(raw, "/production/dashboard");
        if (value.length() > 700 || !value.matches("^/(production|admin/production)/[a-zA-Z0-9/_-]+$") || value.contains("//"))
            throw new BusinessException(400, "仅允许打开生产管理业务页面");
        if (value.startsWith("/admin/") && !ops(user)) throw new BusinessException(403, "当前账号没有生产运营权限");
        return value;
    }
    private String digest(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    public synchronized Map<String,Object> issue(HttpServletRequest request, Map<String,Object> body) {
        String token = request.getHeader("Authorization");
        var user = identity(token);
        long now = System.currentTimeMillis();
        tickets.entrySet().removeIf(e -> e.getValue().expiresAt < now);
        if (tickets.size() >= 2000) throw new BusinessException(429, "登录交接请求过多，请稍后重试");
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tickets.put(digest(code), new Ticket(token, target(body.get("target"), user), now + 60000));
        return Map.of("ticket", code, "expiresIn", 60);
    }
    public Map<String,Object> exchange(Map<String,Object> body) {
        String code = Objects.toString(body.get("ticket"), "");
        if (!code.matches("[A-Za-z0-9_-]{43}")) throw new BusinessException(400, "登录交接票据无效");
        Ticket ticket = tickets.remove(digest(code));
        if (ticket == null || ticket.expiresAt < System.currentTimeMillis()) throw new BusinessException(401, "登录交接已过期或已使用，请返回重新打开");
        var user = identity(ticket.token);
        target(ticket.target, user);
        long seconds = 300;
        try {
            var claims = mapper.readTree(Base64.getUrlDecoder().decode(ticket.token.substring(7).split("\\.")[1]));
            seconds = Math.max(1, claims.path("exp").asLong() - System.currentTimeMillis()/1000);
        } catch (Exception ignored) { /* 失效判定以统一认证为准；未知有效期最多按5分钟显示。 */ }
        return Map.of("accessToken", ticket.token.substring(7), "expiresIn", seconds, "user", user, "target", ticket.target);
    }
}
