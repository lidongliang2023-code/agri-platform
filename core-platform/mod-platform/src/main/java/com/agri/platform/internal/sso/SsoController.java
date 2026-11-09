package com.agri.platform.internal.sso;

import com.agri.core.infra.security.RefreshCookieSupport;
import com.agri.platform.internal.account.MfaService;
import com.agri.platform.internal.auth.AuthService;
import com.agri.platform.internal.auth.dto.AuthOutcome;
import com.agri.platform.internal.auth.dto.LoginRequest;
import com.agri.platform.internal.auth.dto.LoginVO;
import com.agri.platform.internal.auth.dto.UserVO;
import com.agri.platform.internal.auth.dto.RefreshRequest;
import com.agri.platform.internal.merchant.MerchantEntity;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.platform.internal.merchant.UserMerchantEntity;
import com.agri.platform.internal.merchant.UserMerchantMapper;
import com.agri.platform.internal.sso.dto.SsoLoginRequest;
import com.agri.platform.internal.sso.dto.SsoLoginResult;
import com.agri.platform.internal.sso.dto.SmsCodeRequest;
import com.agri.platform.internal.sso.dto.SmsLoginRequest;
import com.agri.platform.internal.sso.dto.SmsRegisterRequest;
import com.agri.platform.internal.sso.dto.SsoTokenRequest;
import com.agri.platform.internal.user.UserEntity;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
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
import com.agri.platform.internal.account.UserOperationLogService;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

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
    /** 用户操作日志：登录也要留痕，否则「操作日志」页里永远看不到登录记录 */
    private final UserOperationLogService operationLog;
    private final AuthorizationCodeService codeService;
    private final SsoProperties properties;
    private final RefreshCookieSupport cookieSupport;
    /** 手机验证码登录 / 注册（2026-10-16）。 */
    private final SmsAuthService smsAuthService;
    private final MerchantMapper merchantMapper;
    private final UserMerchantMapper userMerchantMapper;
    private final MfaService mfaService;
    private final com.agri.platform.internal.permission.UserPermissionService userPermissionService;
    /** 账号侧策略：注册开关 / 注册方式（运营端可改） */
    private final com.agri.platform.internal.uc.AccountPolicyService accountPolicy;

    /** 授权端点：有登录态则发码回跳，无则转登录页 */
    @GetMapping("/authorize")
    public ResponseEntity<Void> authorize(@RequestParam("client_id") String clientId,
                                          @RequestParam("redirect_uri") String redirectUri,
                                          @RequestParam(value = "state", required = false) String state,
                                          @RequestParam(value = "code_challenge", required = false) String codeChallenge,
                                          @RequestParam(value = "code_challenge_method", required = false) String codeChallengeMethod,
                                          HttpServletRequest request) {
        assertClient(clientId, redirectUri);
        long[] session = sessionService.resolve(request, clientId);
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
        assertIdentity(user.userId(), request.identity());
        sessionService.createForClient(user.userId(), user.marketId(), Boolean.TRUE.equals(request.remember()),
                request.clientId(), response);
        SmsAuthService.OnboardingStatus onboarding = smsAuthService.onboardingStatus(user.userId(), user.marketId());
        if (!canEnterUserCenterOperations(user.userId(), user.marketId(), request.clientId())
                && !"done".equals(onboarding.stage())) {
            return ApiResponse.ok(new SsoLoginResult(null, onboarding.stage()));
        }
        String code = codeService.issue(user.userId(), user.marketId(), request.clientId(), request.redirectUri(),
                request.codeChallenge(), request.codeChallengeMethod());
        return ApiResponse.ok(new SsoLoginResult(callback(request.redirectUri(), code, request.state())));
    }

    /**
     * 发送手机验证码（登录 / 注册 / 找回密码）。
     *
     * <p>短信通道未配置真实服务商时（{@code agri.auth.sms.mode=none}）**直接拒绝**并说明原因；
     * dev 模式下验证码只写**后端日志**，不回响应体 —— 页面流程与生产一致，不会把验证码漏给前端。</p>
     *
     * <p>这是公开端点，因此只允许 {@code login / register / reset_password} 三个场景。
     * 换绑手机（change_phone）不在这里发：未登录就能对任意号码发码，等于谁都能替别人
     * 触发短信并把对方刚要用的码顶掉，改走 {@code POST /api/v1/sso/account/phone/code}。</p>
     */
    @PostMapping("/sms/code")
    public ApiResponse<SmsCodeSentResult> sendSmsCode(@Valid @RequestBody SmsCodeRequest request) {
        SmsAuthService.assertPublicScene(request.scene());
        smsAuthService.send(request.phone(), request.scene());
        return ApiResponse.ok(new SmsCodeSentResult(true, smsAuthService.devMode(),
                smsAuthService.devMode() ? "开发模式：验证码已写入后端日志（不回传、不入库明文）"
                        : "验证码已发送"));
    }

    /**
     * 手机号验证码自助重置密码。
     *
     * <p>该端点在未登录时调用。重置成功后吊销该用户全部平台令牌与 SSO 会话，
     * 防止旧会话在修改密码后继续使用。</p>
     */
    @PostMapping("/password-reset")
    public ApiResponse<Void> resetPassword(@RequestBody PasswordResetRequest request) {
        if (request == null || trimToNull(request.phone()) == null || trimToNull(request.code()) == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "手机号与验证码不能为空");
        }
        if (request.newPassword() == null || !request.newPassword().equals(request.confirmPassword())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "两次输入的密码不一致");
        }
        Long userId = smsAuthService.resetPassword(request.phone(), request.code(), request.newPassword());
        sessionService.revokeAllForUser(userId);
        authService.revokeAllSessions(userId);
        return ApiResponse.ok();
    }

    /** 手机验证码登录：凭据是「手机号 + 短信验证码」，其余与密码登录同一套授权上下文。 */
    @PostMapping("/login-by-sms")
    public ApiResponse<SsoLoginResult> loginBySms(@Valid @RequestBody SmsLoginRequest request,
                                                 HttpServletResponse response) {
        assertClient(request.clientId(), request.redirectUri());
        smsAuthService.verify(request.phone(), "login", request.code());
        UserEntity user = smsAuthService.requireUserByPhone(request.phone());
        assertIdentity(user.getId(), request.identity());
        Long marketId = request.marketId() == null ? 1L : request.marketId();
        return ApiResponse.ok(signIn(user.getId(), marketId, request.clientId(), request.redirectUri(),
                request.state(), request.codeChallenge(), request.codeChallengeMethod(),
                Boolean.TRUE.equals(request.remember()), response));
    }

    /**
     * 独立认证中心登录：没有子系统 client_id/redirect_uri 时也能用账号密码登录。
     * 建立 SSO 会话并下发平台令牌，随后按开通阶段或角色返回站内跳转地址。
     */
    @PostMapping("/login-standalone")
    public ApiResponse<StandaloneLoginResult> loginStandalone(
            @RequestBody StandaloneLoginRequest request, HttpServletResponse response) {
        AuthOutcome outcome = authService.login(new LoginRequest(request.username(), request.password(),
                request.marketId(), request.phone()));
        LoginVO login = outcome.body();
        Long marketId = request.marketId() == null ? 1L : request.marketId();
        // 二次验证：密码对了还不够。这里**先不建会话**，只签发一个 5 分钟的一次性挑战，
        // 校验通过后才真正登录 —— 否则"拦在登录上"就成了一句空话。
        if (mfaService.isActive(login.user().id())) {
            String challenge = mfaService.issueChallenge(login.user().id());
            operationLog.record(login.user().id(), "login_mfa_challenge", "登录待二次验证",
                    login.user().username(), null);
            return ApiResponse.ok(new StandaloneLoginResult(null, null, null, null, 0L,
                    true, challenge));
        }
        sessionService.create(login.user().id(), marketId, !Boolean.FALSE.equals(request.remember()), response);
        cookieSupport.write(response, outcome.refreshToken());
        operationLog.record(login.user().id(), "login", "登录账号",
                login.user().username(), "通过统一认证中心登录");
        return ApiResponse.ok(standaloneResult(login, marketId));
    }

    /**
     * 登录第二步：提交二次验证码。
     *
     * <p>用一次性 challenge 换 userId，**不接受前端自报用户 id** —— 否则改个 id 就能绕过密码。
     * challenge 校验后立即从 Redis 删除，失败也只能重新走一次密码登录（防暴力试码）。</p>
     */
    @PostMapping("/login-standalone-mfa")
    public ApiResponse<StandaloneLoginResult> loginStandaloneMfa(
            @RequestBody StandaloneMfaLoginRequest request, HttpServletResponse response) {
        Long userId = mfaService.consumeChallenge(request.challengeToken());
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "登录已超时，请重新输入账号密码");
        }
        if (!mfaService.verifyCode(userId, request.code(), true)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "验证码不正确，请重新登录后再试");
        }
        Long marketId = request.marketId() == null ? 1L : request.marketId();
        AuthOutcome outcome = authService.issueTokens(userId, marketId);
        sessionService.create(userId, marketId, !Boolean.FALSE.equals(request.remember()), response);
        cookieSupport.write(response, outcome.refreshToken());
        operationLog.record(userId, "login", "登录账号", null, "二次验证通过");
        return ApiResponse.ok(standaloneResult(outcome.body(), marketId));
    }

    /** 登录第二步入参：challengeToken 由第一步返回 */
    public record StandaloneMfaLoginRequest(String challengeToken, String code, Long marketId,
                                            Boolean remember) {
    }

    /** 独立认证中心的手机验证码登录。 */
    @PostMapping("/login-standalone-by-sms")
    public ApiResponse<StandaloneLoginResult> loginStandaloneBySms(
            @RequestBody StandaloneSmsLoginRequest request, HttpServletResponse response) {
        smsAuthService.verify(request.phone(), "login", request.code());
        UserEntity user = smsAuthService.requireUserByPhone(request.phone());
        Long marketId = request.marketId() == null ? 1L : request.marketId();
        // 短信登录同样要过二次验证：手机号只是"持有证明"，不能替代验证器
        if (mfaService.isActive(user.getId())) {
            String challenge = mfaService.issueChallenge(user.getId());
            operationLog.record(user.getId(), "login_mfa_challenge", "登录待二次验证",
                    user.getUsername(), "短信登录");
            return ApiResponse.ok(new StandaloneLoginResult(null, null, null, null, 0L,
                    true, challenge));
        }
        AuthOutcome outcome = authService.issueTokens(user.getId(), marketId);
        sessionService.create(user.getId(), marketId, !Boolean.FALSE.equals(request.remember()), response);
        cookieSupport.write(response, outcome.refreshToken());
        return ApiResponse.ok(standaloneResult(outcome.body(), marketId));
    }

    private StandaloneLoginResult standaloneResult(LoginVO login, Long marketId) {
        SmsAuthService.OnboardingStatus onboarding = smsAuthService.onboardingStatus(login.user().id(), marketId);
        String stage = onboarding.stage();
        if (userPermissionService.resolvePlatform(login.user().id()).has("uc:admin")) {
            return new StandaloneLoginResult("done", "/user-center-ops/", login.user(),
                    login.accessToken(), login.expiresIn(), false, null);
        }
        String redirect;
        if (!"done".equals(stage)) {
            redirect = "/register?step=" + ("subject".equals(stage) ? 2 : 3);
        } else {
            List<String> roles = login.user().roles() == null ? List.of() : login.user().roles();
            boolean ops = roles.stream().anyMatch(role -> role.equals("SUPER_ADMIN")
                    || role.equals("MARKET_OPS") || role.endsWith("ADMIN") || role.endsWith("OPS"));
            redirect = ops ? "/admin/production/dashboard" : "/production/dashboard";
        }
        return new StandaloneLoginResult(stage, redirect, login.user(), login.accessToken(),
                login.expiresIn(), false, null);
    }

    /**
     * 手机号验证码注册：注册成功即登录（同一授权上下文签码回跳，用户不必再登一次）。

     *
     * <p>账号建好但**不绑定经营主体** —— 绑定到哪家主体、什么身份是产品口径；
     * 未绑定账号进业务域会收到可读的"还没有绑定经营主体"提示（见 {@code SmsAuthService.registerByPhone}）。</p>
     */
    @PostMapping("/register-by-sms")
    public ApiResponse<SsoLoginResult> registerBySms(@Valid @RequestBody SmsRegisterRequest request,
                                                    HttpServletResponse response) {
        // 从子系统进入时带授权上下文；直接从认证中心 /register 进入时没有上下文，
        // 此时仍然允许注册（公开自助注册），只建会话、不签授权码。
        String clientId = trimToNull(request.clientId());
        String redirectUri = trimToNull(request.redirectUri());
        boolean hasContext = clientId != null && redirectUri != null;
        if (hasContext) {
            assertClient(clientId, redirectUri);
        }
        // 先校验注册策略：平台暂停注册时，不该先消耗掉用户的验证码
        accountPolicy.assertRegistrationAllowed("phone");
        smsAuthService.verify(request.phone(), "register", request.code());
        Long marketId = request.marketId() == null ? 1L : request.marketId();
        UserEntity user = smsAuthService.registerByPhone(request.phone(),
                new SmsAuthService.RegistrationProfile(request.nickname(), request.password(), request.identity(),
                        request.companyName(), request.creditCode(), request.industry(), request.companySize(),
                        request.address(), request.realName(), request.idCard(), request.businessType(),
                        request.contactName()),
                marketId);
        if (!hasContext) {
            // 独立注册：建全局会话，之后从任一子系统入口进入都无需再输密码
            sessionService.create(user.getId(), marketId, true, response);
            return ApiResponse.ok(new SsoLoginResult(null));
        }
        return ApiResponse.ok(signIn(user.getId(), marketId, clientId, redirectUri,
                request.state(), request.codeChallenge(), request.codeChallengeMethod(), false, response));
    }

    /** 分步注册第 1 步：只创建登录账号，随后返回主体创建阶段。 */
    @PostMapping("/register-account")
    public ApiResponse<SmsAuthService.OnboardingStatus> registerAccount(
            @RequestBody AccountRegisterRequest request, HttpServletResponse response) {
        if (request == null || request.phone() == null || request.code() == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "手机号与验证码不能为空");
        }
        accountPolicy.assertRegistrationAllowed("phone");
        smsAuthService.verify(request.phone(), "register", request.code());
        Long marketId = request.marketId() == null ? 1L : request.marketId();
        UserEntity user = smsAuthService.registerAccountByPhone(request.phone(), request.password(),
                request.nickname(), marketId);
        sessionService.create(user.getId(), marketId, !Boolean.FALSE.equals(request.remember()), response);
        return ApiResponse.ok(smsAuthService.onboardingStatus(user.getId(), marketId));
    }

    /** 当前账号的开通阶段（注册页刷新后恢复步骤）。 */
    @GetMapping("/onboarding/status")
    public ApiResponse<SmsAuthService.OnboardingStatus> onboardingStatus(HttpServletRequest request) {
        long[] session = requireSession(request);
        return ApiResponse.ok(smsAuthService.onboardingStatus(session[0], session[1]));
    }

    /** 分步注册第 2 步：创建经营主体并保存 draft 认证资料。 */
    @PostMapping("/onboarding/subject")
    public ApiResponse<SmsAuthService.OnboardingStatus> createSubject(
            @RequestBody SmsAuthService.SubjectProfile request, HttpServletRequest httpRequest) {
        long[] session = requireSession(httpRequest);
        return ApiResponse.ok(smsAuthService.createSubject(session[0], session[1], request));
    }

    /** 分步注册第 3 步：激活 draft 认证为 pending，并可选签发回跳授权码。 */
    @PostMapping("/onboarding/certification")
    public ApiResponse<ActivateCertificationResult> activateCertification(
            @RequestBody(required = false) CertificationContext request, HttpServletRequest httpRequest,
            HttpServletResponse response) {
        long[] session = requireSession(httpRequest);
        SmsAuthService.OnboardingStatus status = smsAuthService.activateCertification(session[0], session[1]);
        String redirect = null;
        if (request != null && trimToNull(request.clientId()) != null && trimToNull(request.redirectUri()) != null) {
            assertClient(request.clientId(), request.redirectUri());
            // 分步注册只建了全局会话；这里补写子系统专属会话，注册完成后回跳即可直接进入
            sessionService.createForClient(session[0], session[1], true, request.clientId(), response);
            String code = codeService.issue(session[0], session[1], request.clientId(), request.redirectUri(),
                    request.codeChallenge(), request.codeChallengeMethod());
            redirect = callback(request.redirectUri(), code, request.state());
        }
        return ApiResponse.ok(new ActivateCertificationResult(status.stage(), redirect));
    }

    private long[] requireSession(HttpServletRequest request) {
        long[] session = sessionService.resolve(request);
        if (session == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "登录会话已失效，请重新登录");
        }
        return session;
    }

    public record AccountRegisterRequest(String phone, String code, String password, String nickname,
                                         Long marketId, Boolean remember) {
    }

    public record PasswordResetRequest(String phone, String code, String newPassword, String confirmPassword) {
    }

    public record StandaloneLoginRequest(String username, String phone, String password,
                                         Long marketId, Boolean remember) {
    }

    public record StandaloneSmsLoginRequest(String phone, String code, Long marketId, Boolean remember) {
    }

    /**
     * 独立登录结果。
     *
     * <p>{@code mfaRequired=true} 时其余字段为空，调用方必须走第二步提交验证码，
     * 用 {@code challengeToken} 换真正的登录态。</p>
     */
    public record StandaloneLoginResult(String stage, String redirect, UserVO user,
                                        String accessToken, long expiresIn,
                                        Boolean mfaRequired, String challengeToken) {
    }

    public record CertificationContext(String clientId, String redirectUri, String state,
                                       String codeChallenge, String codeChallengeMethod) {
    }

    public record ActivateCertificationResult(String stage, String redirect) {
    }

    /** 建全局会话 → 签授权码 → 拼回跳地址（密码登录 / 验证码登录 / 注册共用这一段）。 */
    private SsoLoginResult signIn(Long userId, Long marketId, String clientId, String redirectUri, String state,
                                  String codeChallenge, String codeChallengeMethod, boolean remember,
                                  HttpServletResponse response) {
        if (clientId == null || clientId.isBlank()) {
            sessionService.create(userId, marketId, remember, response);
        } else {
            sessionService.createForClient(userId, marketId, remember, clientId, response);
        }
        SmsAuthService.OnboardingStatus onboarding = smsAuthService.onboardingStatus(userId, marketId);
        if (!canEnterUserCenterOperations(userId, marketId, clientId)
                && !"done".equals(onboarding.stage())) {
            return new SsoLoginResult(null, onboarding.stage());
        }
        String code = codeService.issue(userId, marketId, clientId, redirectUri, codeChallenge, codeChallengeMethod);
        return new SsoLoginResult(callback(redirectUri, code, state));
    }

    /** 运营履职不依赖经营主体认证；权限仍按当前市场实时解析。 */
    private boolean canEnterUserCenterOperations(Long userId, Long marketId, String clientId) {
        if ("user-center-ops".equals(clientId) || "portal".equals(clientId)) {
            return userPermissionService.resolvePlatform(userId).has("uc:admin");
        }
        if ("gov-ops".equals(clientId)) {
            return userPermissionService.resolve(userId, marketId).has("gov:admin");
        }
        return false;
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
        // 子系统专属刷新令牌：避免 A 子系统刷新时拿到 B 子系统账号的令牌
        cookieSupport.writeForClient(response, outcome.refreshToken(), code.clientId());
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
        sessionService.destroy(request, response, clientId);
        cookieSupport.clearForClient(response, clientId);
        // 回到该客户端注册在案的第一个来源（取自配置白名单，不是请求参数 —— 避免开放重定向）
        return redirect(allowed.get(0) + "?logout=1");
    }

    /**
     * 登录身份校验（2026-10-20 按原型补的「企业会员 / 个人会员」）。
     *
     * <p>注册时会把会员身份写到经营主体（member_type）。登录时若该账号名下
     * <b>已有带身份的</b>经营主体，则要求所选身份至少匹配其中一家；
     * 历史账号的主体没有这个字段，保持原样放行 —— 不能因为补了一个新字段把老账号挡在门外。</p>
     */
    private void assertIdentity(Long userId, String identity) {
        if (identity == null || identity.isBlank()) {
            return;
        }
        String wanted = identity.trim().toLowerCase();
        if (!"enterprise".equals(wanted) && !"personal".equals(wanted)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "登录身份只能是 enterprise 或 personal");
        }
        List<Long> merchantIds = userMerchantMapper.selectList(new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, userId)
                        .eq(UserMerchantEntity::getStatus, 1))
                .stream().map(UserMerchantEntity::getMerchantId).collect(Collectors.toList());
        if (merchantIds.isEmpty()) {
            return;
        }
        List<MerchantEntity> merchants = merchantMapper.selectList(new LambdaQueryWrapper<MerchantEntity>()
                .in(MerchantEntity::getId, merchantIds));
        List<MerchantEntity> typed = merchants.stream()
                .filter(item -> item.getMemberType() != null && !item.getMemberType().isBlank())
                .collect(Collectors.toList());
        if (typed.isEmpty()) {
            return;
        }
        boolean matched = typed.stream().anyMatch(item -> wanted.equalsIgnoreCase(item.getMemberType()));
        if (!matched) {
            String registered = typed.get(0).getMemberType();
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "该账号注册身份为「" + ("personal".equalsIgnoreCase(registered) ? "个人会员" : "企业会员")
                            + "」，请切换登录身份后重试");
        }
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

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
