package com.agri.platform.internal.auth;

import com.agri.core.infra.security.RefreshCookieSupport;
import com.agri.platform.internal.auth.dto.AuthOutcome;
import com.agri.platform.internal.auth.dto.LoginVO;
import com.agri.platform.internal.sso.GlobalLogoutService;
import com.agri.platform.internal.sso.SsoProperties;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 公开页面可选续签：匿名访客不报 5003，携带失效凭证仍如实报错。 */
class AuthControllerOptionalRefreshTest {

    private AuthService authService;
    private RefreshCookieSupport cookieSupport;
    private AuthController controller;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        cookieSupport = mock(RefreshCookieSupport.class);
        controller = new AuthController(authService, mock(GlobalLogoutService.class), cookieSupport,
                new SsoProperties());
    }

    @Test
    @DisplayName("可选续签：请求里没有任何刷新凭证时返回 code=0、data=null，不调用续签")
    void optionalRefreshWithoutCredentialReturnsNull() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/refresh");
        request.addHeader(AuthController.AUTH_OPTIONAL_HEADER, "1");

        var resp = controller.refresh(null, request, new MockHttpServletResponse());

        assertThat(resp.getCode()).isEqualTo(0);
        assertThat(resp.getData()).isNull();
        verify(authService, never()).refresh(anyString());
    }

    @Test
    @DisplayName("可选续签：携带已失效的刷新凭证时仍返回 5003，不掩盖真实失效")
    void optionalRefreshWithInvalidCredentialStillFails() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/refresh");
        request.addHeader(AuthController.AUTH_OPTIONAL_HEADER, "1");
        when(cookieSupport.read(any())).thenReturn("expired-token");
        when(authService.refresh("expired-token"))
                .thenThrow(new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID));

        assertThatThrownBy(() -> controller.refresh(null, request, new MockHttpServletResponse()))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("可选续签：携带有效刷新凭证时正常续签")
    void optionalRefreshWithValidCredentialRefreshes() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/refresh");
        request.addHeader(AuthController.AUTH_OPTIONAL_HEADER, "1");
        when(cookieSupport.read(any())).thenReturn("good-token");
        LoginVO body = mock(LoginVO.class);
        when(authService.refresh("good-token")).thenReturn(new AuthOutcome(body, "next-token"));

        var resp = controller.refresh(null, request, new MockHttpServletResponse());

        assertThat(resp.getData()).isSameAs(body);
    }

    @Test
    @DisplayName("未带可选头的旧调用方：无凭证时保持原行为，按 5003 拒绝")
    void plainRefreshWithoutCredentialStillFails() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/refresh");

        assertThatThrownBy(() -> controller.refresh(null, request, new MockHttpServletResponse()))
                .isInstanceOf(BusinessException.class);
        verify(authService, never()).refresh(anyString());
    }
}
