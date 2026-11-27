package com.agri.platform.internal.sso;

import com.agri.core.infra.security.RefreshCookieSupport;
import com.agri.platform.internal.account.MfaService;
import com.agri.platform.internal.account.UserOperationLogService;
import com.agri.platform.internal.auth.AuthService;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.platform.internal.merchant.UserMerchantMapper;
import com.agri.platform.internal.permission.UserPermissionService;
import com.agri.platform.internal.sso.dto.SsoLoginRequest;
import com.agri.platform.internal.sso.dto.SsoLoginResult;
import com.agri.platform.internal.uc.AccountPolicyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SsoControllerOnboardingGateTest {

    private AuthService authService;
    private SsoSessionService sessionService;
    private AuthorizationCodeService codeService;
    private SmsAuthService smsAuthService;
    private UserPermissionService userPermissionService;
    private SsoController controller;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        sessionService = mock(SsoSessionService.class);
        codeService = mock(AuthorizationCodeService.class);
        smsAuthService = mock(SmsAuthService.class);
        userPermissionService = mock(UserPermissionService.class);
        UserMerchantMapper userMerchantMapper = mock(UserMerchantMapper.class);
        when(userMerchantMapper.selectList(any())).thenReturn(List.of());
        controller = new SsoController(
                authService,
                mock(GlobalLogoutService.class),
                sessionService,
                mock(UserOperationLogService.class),
                codeService,
                new SsoProperties(),
                mock(RefreshCookieSupport.class),
                smsAuthService,
                mock(MerchantMapper.class),
                userMerchantMapper,
                mock(MfaService.class),
                userPermissionService,
                mock(AccountPolicyService.class)
        );
    }

    private SmsAuthService.OnboardingStatus status(String stage) {
        return new SmsAuthService.OnboardingStatus(
                stage, "13800000001", "测试账号", "enterprise",
                1001L, "测试主体", stage, null, SmsAuthService.VerificationProgress.empty());
    }

    @Test
    @DisplayName("未完成主体认证时登录只建全局引导会话、不写子系统专属会话且不签授权码")
    void loginWithPendingOnboardingDoesNotWriteClientSessionOrIssueCode() {
        when(authService.authenticate(any()))
                .thenReturn(new AuthService.AuthenticatedUser(10L, 1L));
        when(smsAuthService.onboardingStatus(10L, 1L)).thenReturn(status("subject"));

        SsoLoginRequest req = new SsoLoginRequest(
                "fund", "Admin@123", 1L, null,
                "finance", "http://localhost:8081/finance/sso/callback",
                "st-1", "challenge-1", "S256", null, false);
        MockHttpServletResponse response = new MockHttpServletResponse();

        SsoLoginResult result = controller.login(req, response).getData();

        assertThat(result.redirect()).isNull();
        assertThat(result.stage()).isEqualTo("subject");
        verify(sessionService).create(eq(10L), eq(1L), eq(false), eq(response));
        verify(sessionService, never()).createForClient(anyLong(), anyLong(), anyBoolean(), anyString(), any());
        verify(codeService, never()).issue(anyLong(), anyLong(), anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("未完成主体认证时再次访问 /authorize 不允许绕过签码，而是带着授权参数重定向到分步注册页")
    void authorizeRedirectsToRegisterWhenOnboardingIncomplete() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/sso/authorize");
        request.setQueryString("client_id=finance&redirect_uri=http%3A%2F%2Flocalhost%3A8081%2Ffinance%2Fsso%2Fcallback&state=st-2&step=1");
        when(sessionService.resolve(request, "finance")).thenReturn(new long[]{10L, 1L});
        when(smsAuthService.onboardingStatus(10L, 1L)).thenReturn(status("subject"));

        ResponseEntity<Void> resp = controller.authorize(
                "finance", "http://localhost:8081/finance/sso/callback", "st-2", "ch-2", "S256", request);

        assertThat(resp.getStatusCode().value()).isEqualTo(302);
        String location = resp.getHeaders().getLocation().toString();
        assertThat(location).startsWith("/register?");
        assertThat(location).contains("client_id=finance");
        assertThat(location).contains("state=st-2");
        assertThat(location).endsWith("step=2");
        assertThat(location).doesNotContain("step=1");
        verify(codeService, never()).issue(anyLong(), anyLong(), anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("认证审核中（pending）访问 /authorize 引导到第 3 步而非签发授权码")
    void authorizeRedirectsPendingCertificationToStep3() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/sso/authorize");
        request.setQueryString("client_id=finance&redirect_uri=http%3A%2F%2Flocalhost%3A8081%2Ffinance%2Fsso%2Fcallback&state=st-3");
        when(sessionService.resolve(request, "finance")).thenReturn(new long[]{10L, 1L});
        when(smsAuthService.onboardingStatus(10L, 1L)).thenReturn(status("pending"));

        ResponseEntity<Void> resp = controller.authorize(
                "finance", "http://localhost:8081/finance/sso/callback", "st-3", "ch-3", "S256", request);

        assertThat(resp.getStatusCode().value()).isEqualTo(302);
        assertThat(resp.getHeaders().getLocation().toString()).contains("/register?").endsWith("step=3");
        verify(codeService, never()).issue(anyLong(), anyLong(), anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("已完成认证的账号在登录与 /authorize 时正常写子系统会话并签发授权码")
    void doneOnboardingIssuesCodeNormally() {
        when(authService.authenticate(any()))
                .thenReturn(new AuthService.AuthenticatedUser(11L, 1L));
        when(smsAuthService.onboardingStatus(11L, 1L)).thenReturn(status("done"));
        when(codeService.issue(11L, 1L, "finance", "http://localhost:8081/finance/sso/callback", "ch", "S256"))
                .thenReturn("code-ok");

        SsoLoginRequest req = new SsoLoginRequest(
                "farmer", "Admin@123", 1L, null,
                "finance", "http://localhost:8081/finance/sso/callback",
                "st-ok", "ch", "S256", null, true);
        MockHttpServletResponse response = new MockHttpServletResponse();

        SsoLoginResult result = controller.login(req, response).getData();

        assertThat(result.redirect()).isEqualTo("http://localhost:8081/finance/sso/callback?code=code-ok&state=st-ok");
        verify(sessionService).createForClient(11L, 1L, true, "finance", response);
    }

    @Test
    @DisplayName("具备运营权限的特例客户端在主体未认证时仍允许直接签码进入")
    void opsExemptionAllowsAuthorizeWithoutOnboarding() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/sso/authorize");
        request.setQueryString("client_id=ai-ops&redirect_uri=http%3A%2F%2Flocalhost%3A8116%2Fsso%2Fcallback&state=st-ai");
        when(sessionService.resolve(request, "ai-ops")).thenReturn(new long[]{1L, 1L});
        when(userPermissionService.resolve(1L, 1L))
                .thenReturn(new UserPermissionService.Resolved(1L, 1L, List.of("SUPER_ADMIN"), Set.of("ai:admin")));
        when(codeService.issue(1L, 1L, "ai-ops", "http://localhost:8116/sso/callback", "ch", "S256"))
                .thenReturn("ai-code");

        ResponseEntity<Void> resp = controller.authorize(
                "ai-ops", "http://localhost:8116/sso/callback", "st-ai", "ch", "S256", request);

        assertThat(resp.getStatusCode().value()).isEqualTo(302);
        assertThat(resp.getHeaders().getLocation().toString())
                .isEqualTo("http://localhost:8116/sso/callback?code=ai-code&state=st-ai");
    }

    @Test
    @DisplayName("提交认证进入审核中（pending）时不写子系统会话、不提前签发回跳授权码")
    void activateCertificationPendingDoesNotBypassGate() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/sso/onboarding/certification");
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(sessionService.resolve(request)).thenReturn(new long[]{10L, 1L});
        when(smsAuthService.activateCertification(10L, 1L)).thenReturn(status("pending"));

        SsoController.ActivateCertificationResult result = controller.activateCertification(
                new SsoController.CertificationContext(
                        "finance", "http://localhost:8081/finance/sso/callback", "st-p", "ch-p", "S256"),
                request, response).getData();

        assertThat(result.stage()).isEqualTo("pending");
        assertThat(result.redirect()).isNull();
        verify(sessionService, never()).createForClient(anyLong(), anyLong(), anyBoolean(), anyString(), any());
        verify(codeService, never()).issue(anyLong(), anyLong(), anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("公开页面可选探测：无会话时返回 code=0、data=null，不再按业务 401 报错")
    void optionalOnboardingStatusReturnsNullForAnonymous() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/sso/onboarding/status");
        when(sessionService.resolve(request)).thenReturn(null);

        var resp = controller.onboardingStatus(request, true);

        assertThat(resp.getCode()).isEqualTo(0);
        assertThat(resp.getData()).isNull();
        verify(smsAuthService, never()).onboardingStatus(anyLong(), anyLong());
    }

    @Test
    @DisplayName("公开页面可选探测：有会话时正常返回开通阶段")
    void optionalOnboardingStatusReturnsStatusWhenLoggedIn() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/sso/onboarding/status");
        when(sessionService.resolve(request)).thenReturn(new long[]{11L, 1L});
        when(smsAuthService.onboardingStatus(11L, 1L)).thenReturn(status("done"));

        var resp = controller.onboardingStatus(request, true);

        assertThat(resp.getData()).isNotNull();
        assertThat(resp.getData().stage()).isEqualTo("done");
    }

    @Test
    @DisplayName("不带 optional 的注册页调用在无会话时仍按未登录拒绝")
    void requiredOnboardingStatusStillRejectsAnonymous() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/sso/onboarding/status");
        when(sessionService.resolve(request)).thenReturn(null);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> controller.onboardingStatus(request, false))
                .isInstanceOf(com.agri.shared.exception.BusinessException.class);
    }
}
