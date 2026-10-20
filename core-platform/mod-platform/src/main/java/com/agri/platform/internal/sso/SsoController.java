package com.agri.platform.internal.sso;

import com.agri.core.infra.security.RefreshCookieSupport;
import com.agri.platform.internal.auth.AuthService;
import com.agri.platform.internal.auth.dto.AuthOutcome;
import com.agri.platform.internal.auth.dto.LoginRequest;
import com.agri.platform.internal.auth.dto.LoginVO;
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
    private final AuthorizationCodeService codeService;
    private final SsoProperties properties;
    private final RefreshCookieSupport cookieSupport;
    /** 手机验证码登录 / 注册（2026-10-16）。 */
    private final SmsAuthService smsAuthService;
    private final MerchantMapper merchantMapper;
    private final UserMerchantMapper userMerchantMapper;

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
        assertIdentity(user.userId(), request.identity());
        sessionService.create(user.userId(), user.marketId(), Boolean.TRUE.equals(request.remember()), response);
        SmsAuthService.OnboardingStatus onboarding = smsAuthService.onboardingStatus(user.userId(), user.marketId());
        if (!"done".equals(onboarding.stage())) {
            return ApiResponse.ok(new SsoLoginResult(null, onboarding.stage()));
        }
        String code = codeService.issue(user.userId(), user.marketId(), request.clientId(), request.redirectUri(),
                request.codeChallenge(), request.codeChallengeMethod());
        return ApiResponse.ok(new SsoLoginResult(callback(request.redirectUri(), code, request.state())));
    }

    /**
     * 发送手机验证码（登录 / 注册共用）。

     *
     * <p>短信通道未配置真实服务商时（{@code agri.auth.sms.mode=none}）**直接拒绝**并说明原因；
     * dev 模式下验证码只写**后端日志**，不回响应体 —— 页面流程与生产一致，不会把验证码漏给前端。</p>
     */
    @PostMapping("/sms/code")
    public ApiResponse<SmsCodeSentResult> sendSmsCode(@Valid @RequestBody SmsCodeRequest request) {
        smsAuthService.send(request.phone(), request.scene());
        return ApiResponse.ok(new SmsCodeSentResult(true, smsAuthService.devMode(),
                smsAuthService.devMode() ? "开发模式：验证码已写入后端日志（不回传、不入库明文）"
                        : "验证码已发送"));
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
            @RequestBody(required = false) CertificationContext request, HttpServletRequest httpRequest) {
        long[] session = requireSession(httpRequest);
        SmsAuthService.OnboardingStatus status = smsAuthService.activateCertification(session[0], session[1]);
        String redirect = null;
        if (request != null && trimToNull(request.clientId()) != null && trimToNull(request.redirectUri()) != null) {
            assertClient(request.clientId(), request.redirectUri());
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

    public record CertificationContext(String clientId, String redirectUri, String state,
                                       String codeChallenge, String codeChallengeMethod) {
    }

    public record ActivateCertificationResult(String stage, String redirect) {
    }

    /** 建全局会话 → 签授权码 → 拼回跳地址（密码登录 / 验证码登录 / 注册共用这一段）。 */
    private SsoLoginResult signIn(Long userId, Long marketId, String clientId, String redirectUri, String state,
                                  String codeChallenge, String codeChallengeMethod, boolean remember,
                                  HttpServletResponse response) {
        sessionService.create(userId, marketId, remember, response);
        SmsAuthService.OnboardingStatus onboarding = smsAuthService.onboardingStatus(userId, marketId);
        if (!"done".equals(onboarding.stage())) {
            return new SsoLoginResult(null, onboarding.stage());
        }
        String code = codeService.issue(userId, marketId, clientId, redirectUri, codeChallenge, codeChallengeMethod);
        return new SsoLoginResult(callback(redirectUri, code, state));
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
