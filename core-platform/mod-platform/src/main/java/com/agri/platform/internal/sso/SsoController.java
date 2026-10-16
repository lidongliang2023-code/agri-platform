package com.agri.platform.internal.sso;

import com.agri.core.infra.security.RefreshCookieSupport;
import com.agri.platform.internal.auth.AuthService;
import com.agri.platform.internal.auth.dto.AuthOutcome;
import com.agri.platform.internal.auth.dto.LoginRequest;
import com.agri.platform.internal.auth.dto.LoginVO;
import com.agri.platform.internal.auth.dto.RefreshRequest;
import com.agri.platform.internal.sso.dto.SsoLoginRequest;
import com.agri.platform.internal.sso.dto.SsoLoginResult;
import com.agri.platform.internal.sso.dto.SsoTokenRequest;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

// SSO 中心端点（V2.0 第 5.2 节：授权码模式 + PKCE；第 5.4 节：单点登出）。
//
// 三个阶段分工明确：
//   1. GET  /authorize —— 子系统把浏览器送过来。已有 SSO 全局会话则直接发码回跳（跨子系统免登）；
//      没有则 302 到本域登录页，并把原始参数原样带过去。
//   2. POST /login     —— 登录页提交凭据。认证通过后建立全局会话、签码、返回回跳地址。
//   3. POST /token     —— 子系统拿 code + PKCE 换令牌。**这是唯一签发令牌的时刻**，
//      且与自有登录页共用 AuthService.issueTokens 同一条签发路径。
@RestController
@RequestMapping("/api/v1/sso")
@RequiredArgsConstructor
public class SsoController {

    private final AuthService authService;
    private final SsoSessionService sessionService;
    private final AuthorizationCodeService codeService;
    private final SsoProperties properties;
    private final RefreshCookieSupport cookieSupport;

    /** 授权端点：有登录态则发码回跳，无则转登录页 */
    @GetMapping("/authorize")
    public ResponseEntity<Void> authorize(@RequestParam("client_id") String clientId,
                                          @RequestParam("redirect_uri") String redirectUri,
                                          @RequestParam(value = "state", required = false) String state,
                                          @RequestParam(value = "code_challenge", required = false) String codeChallenge,
                                          @RequestParam(value = "code_challenge_method", required = false) String codeChallengeMethod,
                                          HttpServletRequest request) {
        assertClient(clientId, redirectUri);
        long[] session = sessionService.resolve(request);
        if (session == null) {
            // 未登录：原始 query 原样带走，避免"这里拼一遍、登录页再拼一遍"两处不一致
            String query = request.getQueryString();
            String location = properties.getLoginPath() + (query == null || query.isBlank() ? "" : "?" + query);
            return redirect(location);
        }
        String code = codeService.issue(session[0], session[1], clientId, redirectUri, codeChallenge, codeChallengeMethod);
        return redirect(callback(redirectUri, code, state));
    }

    /** 登录端点：校验凭据 → 建全局会话 → 签码 → 返回回跳地址 */
    @PostMapping("/login")
    public ApiResponse<SsoLoginResult> login(@Valid @RequestBody SsoLoginRequest request, HttpServletResponse response) {
        assertClient(request.clientId(), request.redirectUri());
        AuthService.AuthenticatedUser user =
                authService.authenticate(new LoginRequest(request.username(), request.password(), request.marketId(),
                        request.phone()));
        sessionService.create(user.userId(), user.marketId(), response);
        String code = codeService.issue(user.userId(), user.marketId(), request.clientId(), request.redirectUri(),
                request.codeChallenge(), request.codeChallengeMethod());
        return ApiResponse.ok(new SsoLoginResult(callback(request.redirectUri(), code, request.state())));
    }

    /** 换票端点：code + PKCE → 平台令牌（访问令牌在响应体，刷新令牌进 HttpOnly Cookie） */
    @PostMapping("/token")
    public ApiResponse<LoginVO> token(@Valid @RequestBody SsoTokenRequest request, HttpServletResponse response) {
        AuthorizationCodeService.AuthorizationCode code = codeService.consume(request.code());
        if (!code.clientId().equals(request.clientId())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "授权码与 client_id 不匹配");
        }
        codeService.verifyPkce(code, request.codeVerifier());
        AuthOutcome outcome = authService.issueTokens(code.userId(), code.marketId());
        cookieSupport.write(response, outcome.refreshToken());
        return ApiResponse.ok(outcome.body());
    }

    /** 单点登出：销毁全局会话（跨子系统免登的凭据），再走平台侧的令牌吊销 */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestBody(required = false) RefreshRequest body,
                                    HttpServletRequest request, HttpServletResponse response) {
        sessionService.destroy(request, response);
        String refreshToken = cookieSupport.read(request);
        authService.logout(refreshToken != null ? refreshToken : (body == null ? null : body.refreshToken()));
        return ApiResponse.ok();
    }

    // 单点登出（浏览器可整页导航的形态；V2.0 第 5.4 节第 1 步：任一子系统点击退出 → 跳转 SSO 登出端点）。
    //
    // 为什么除了 POST 还需要这个 GET：SSO 会话 Cookie 只存在于 sso 域，子系统发起的跨域 XHR
    // 带不上它 —— 在生产拓扑（prod.agri-platform.com 与 sso.agri-platform.com 不同站点）下更是如此。
    // 必须由浏览器整页导航到 sso 域，"销毁全局会话"才发生在正确的域上。这也解释了为什么不能
    // 图省事让子系统直接调自己域的登出接口：那只能清掉子系统，清不掉认证中心。
    @GetMapping("/logout")
    public ResponseEntity<Void> logoutAndRedirect(@RequestParam("client_id") String clientId,
                                                 HttpServletRequest request, HttpServletResponse response) {
        List<String> allowed = properties.getClients().get(clientId);
        if (allowed == null || allowed.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "未注册的 client_id：" + clientId);
        }
        sessionService.destroy(request, response);
        // 回到该客户端注册在案的第一个来源（取自配置白名单，不是请求参数 —— 避免开放重定向）
        return redirect(allowed.get(0) + "?logout=1");
    }

    // client_id 与 redirect_uri 必须成对匹配注册在案的前缀。
    //
    // 这是本流程里最容易被省略、后果也最严重的一步：不校验 redirect_uri，
    // 攻击者可以用同一个 client_id 把 code 收到自己的站点上，等于拿走该用户的会话。
    private void assertClient(String clientId, String redirectUri) {
        List<String> allowed = properties.getClients().get(clientId);
        if (allowed == null || allowed.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "未注册的 client_id：" + clientId);
        }
        if (redirectUri == null || allowed.stream().noneMatch(redirectUri::startsWith)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "redirect_uri 不在白名单：" + redirectUri);
        }
    }

    /** 拼回跳地址：带上 code 与（原样回传的）state */
    private String callback(String redirectUri, String code, String state) {
        String separator = redirectUri.contains("?") ? "&" : "?";
        StringBuilder url = new StringBuilder(redirectUri).append(separator).append("code=").append(code);
        if (state != null && !state.isBlank()) {
            url.append("&state=").append(URLEncoder.encode(state, StandardCharsets.UTF_8));
        }
        return url.toString();
    }

    private ResponseEntity<Void> redirect(String location) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(location)).build();
    }
}
