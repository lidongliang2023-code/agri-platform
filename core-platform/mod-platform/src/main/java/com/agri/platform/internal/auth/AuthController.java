package com.agri.platform.internal.auth;

import com.agri.core.infra.security.RefreshCookieSupport;
import com.agri.platform.internal.auth.dto.AuthOutcome;
import com.agri.platform.internal.auth.dto.LoginRequest;
import com.agri.platform.internal.auth.dto.LoginVO;
import com.agri.platform.internal.auth.dto.RefreshRequest;
import com.agri.platform.internal.auth.dto.UserVO;
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

    @PostMapping("/login")
    public ApiResponse<LoginVO> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthOutcome outcome = authService.login(request);
        cookieSupport.write(response, outcome.refreshToken());
        return ApiResponse.ok(outcome.body());
    }

    @PostMapping("/refresh")
    public ApiResponse<LoginVO> refresh(@RequestBody(required = false) RefreshRequest request,
                                       HttpServletRequest httpRequest, HttpServletResponse response) {
        AuthOutcome outcome = authService.refresh(resolveRefreshToken(httpRequest, request));
        cookieSupport.write(response, outcome.refreshToken());
        return ApiResponse.ok(outcome.body());
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestBody(required = false) RefreshRequest request,
                                    HttpServletRequest httpRequest, HttpServletResponse response) {
        String refreshToken = cookieSupport.read(httpRequest);
        authService.logout(refreshToken != null ? refreshToken
                : (request == null ? null : request.refreshToken()));
        // 无论服务端是否吊销成功，都要把浏览器侧 Cookie 清掉，否则会出现"点了登出、刷新又回来了"
        cookieSupport.clear(response);
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
    private String resolveRefreshToken(HttpServletRequest httpRequest, RefreshRequest request) {
        String fromCookie = cookieSupport.read(httpRequest);
        if (fromCookie != null) {
            return fromCookie;
        }
        String fromBody = request == null ? null : request.refreshToken();
        if (fromBody == null || fromBody.isBlank()) {
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID);
        }
        return fromBody;
    }
}
