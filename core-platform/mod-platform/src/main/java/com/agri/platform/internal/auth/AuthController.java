package com.agri.platform.internal.auth;

import com.agri.core.infra.security.RefreshCookieSupport;
import com.agri.platform.internal.auth.dto.AuthOutcome;
import com.agri.platform.internal.auth.dto.LoginRequest;
import com.agri.platform.internal.auth.dto.LoginVO;
import com.agri.platform.internal.auth.dto.RefreshRequest;
import com.agri.platform.internal.auth.dto.UserVO;
import com.agri.platform.internal.sso.SsoProperties;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.Map;

/**
 * 认证端点。
 *
 * <p><b>刷新令牌的进出通道</b>（V2.0 第 4.3 节）：只走 HttpOnly Cookie，
 * 不进响应体。登录/刷新成功时由本类把刷新令牌写进 Cookie；
 * 刷新/登出时优先读 Cookie，读不到再回退请求体（迁移窗口兼容尚未升级的客户端）。</p>
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RefreshCookieSupport cookieSupport;
    private final SsoProperties ssoProperties;

    @PostMapping("/login")
    public ApiResponse<LoginVO> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthOutcome outcome = authService.login(request);
        cookieSupport.write(response, outcome.refreshToken());
        return ApiResponse.ok(outcome.body());
    }

    @PostMapping("/refresh")
    public ApiResponse<LoginVO> refresh(@RequestBody(required = false) RefreshRequest request,
                                       HttpServletRequest httpRequest, HttpServletResponse response) {
        String clientId = clientIdOf(httpRequest);
        AuthOutcome outcome = authService.refresh(resolveRefreshToken(httpRequest, request, clientId));
        cookieSupport.write(response, outcome.refreshToken());
        cookieSupport.writeForClient(response, outcome.refreshToken(), clientId);
        return ApiResponse.ok(outcome.body());
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestBody(required = false) RefreshRequest request,
                                    HttpServletRequest httpRequest, HttpServletResponse response) {
        String clientId = clientIdOf(httpRequest);
        String refreshToken = clientId == null ? cookieSupport.read(httpRequest)
                : cookieSupport.readForClient(httpRequest, clientId);
        authService.logout(refreshToken != null ? refreshToken
                : (request == null ? null : request.refreshToken()));
        // 无论服务端是否吊销成功，都要把浏览器侧 Cookie 清掉，否则会出现"点了登出、刷新又回来了"
        if (clientId == null) {
            cookieSupport.clear(response);
        } else {
            cookieSupport.clearForClient(response, clientId);
        }
        return ApiResponse.ok();
    }

    @GetMapping("/me")
    public ApiResponse<UserVO> me() {
        return ApiResponse.ok(authService.me());
    }

    /**
     * 取刷新令牌：Cookie 优先，其次请求体，都没有则判为未认证。
     *
     * @param httpRequest 原始请求（读 Cookie）
     * @param request     请求体（迁移窗口回退通道），可为 null
     * @return 刷新令牌
     */
    private String resolveRefreshToken(HttpServletRequest httpRequest, RefreshRequest request, String clientId) {
        String fromCookie = clientId == null ? cookieSupport.read(httpRequest)
                : cookieSupport.readForClient(httpRequest, clientId);
        if (fromCookie != null) {
            return fromCookie;
        }
        // 带了子系统上下文时必须用该子系统的刷新令牌：回退全局等于让 A 子系统拿到 B 的账号
        if (clientId != null) {
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID);
        }
        String fromBody = request == null ? null : request.refreshToken();
        if (fromBody == null || fromBody.isBlank()) {
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID);
        }
        return fromBody;
    }

    /**
     * 从请求推断当前子系统 client_id。
     *
     * <p>优先显式头 {@code X-Sso-Client}；否则按 Referer/Origin 的"源"与注册表里的
     * redirect_uri 前缀比对。这样改造前端刷新调用之前也能按子系统隔离刷新令牌。</p>
     */
    private String clientIdOf(HttpServletRequest request) {
        String explicit = request.getHeader("X-Sso-Client");
        if (explicit != null && !explicit.isBlank() && ssoProperties.getClients().containsKey(explicit.trim())) {
            return explicit.trim();
        }
        String source = request.getHeader("Referer");
        if (source == null || source.isBlank()) {
            source = request.getHeader("Origin");
        }
        String origin = originOf(source);
        if (origin == null) {
            return null;
        }
        for (Map.Entry<String, List<String>> entry : ssoProperties.getClients().entrySet()) {
            for (String prefix : entry.getValue()) {
                if (origin.equals(originOf(prefix))) {
                    return entry.getKey();
                }
            }
        }
        return null;
    }

    private static String originOf(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            URI uri = new URI(url.trim());
            if (uri.getScheme() == null || uri.getHost() == null) {
                return null;
            }
            return uri.getScheme() + "://" + uri.getHost()
                    + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
        } catch (Exception e) {
            return null;
        }
    }
}
