package com.agri.platform.internal.sso;

import com.agri.platform.internal.merchant.ActiveMerchantService;
import com.agri.platform.internal.uc.AccountPolicyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SsoSessionServiceTest {

    private StringRedisTemplate redis;
    private ValueOperations<String, String> values;
    private SsoProperties properties;
    private SsoSessionService service;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        properties = new SsoProperties();
        service = new SsoSessionService(redis, mock(AccountPolicyService.class), properties,
                mock(ActiveMerchantService.class));
        request = mock(HttpServletRequest.class);
    }

    @Test
    @DisplayName("当前子系统会话有效时优先使用客户端会话")
    void clientSessionWinsOverGlobalSession() {
        when(request.getCookies()).thenReturn(new Cookie[]{
                new Cookie("agri_sso_session_s2b2c-platform", "client-sid"),
                new Cookie("agri_sso_session", "global-sid")
        });
        when(values.get("agri:sso:session:client-sid")).thenReturn("101:2001");
        when(values.get("agri:sso:session:global-sid")).thenReturn("202:3001");

        assertThat(service.resolve(request, "s2b2c-platform"))
                .containsExactly(101L, 2001L);
    }

    @Test
    @DisplayName("没有当前子系统会话时回退到全局会话实现跨系统免登")
    void fallsBackToGlobalSessionWhenClientCookieMissing() {
        when(request.getCookies()).thenReturn(new Cookie[]{
                new Cookie("agri_sso_session", "global-sid")
        });
        when(values.get("agri:sso:session:global-sid")).thenReturn("101:2001");

        assertThat(service.resolve(request, "mall-consumer"))
                .containsExactly(101L, 2001L);
    }

    @Test
    @DisplayName("当前子系统会话已过期时回退到仍有效的全局会话")
    void fallsBackToGlobalSessionWhenClientSessionExpired() {
        when(request.getCookies()).thenReturn(new Cookie[]{
                new Cookie("agri_sso_session_ai-ops", "expired-client-sid"),
                new Cookie("agri_sso_session", "global-sid")
        });
        when(values.get("agri:sso:session:expired-client-sid")).thenReturn(null);
        when(values.get("agri:sso:session:global-sid")).thenReturn("101:2001");

        assertThat(service.resolve(request, "ai-ops"))
                .containsExactly(101L, 2001L);
    }

    @Test
    @DisplayName("没有任何有效会话时仍返回未登录")
    void returnsNullWhenBothSessionsAreUnavailable() {
        when(request.getCookies()).thenReturn(new Cookie[]{
                new Cookie("agri_sso_session_mdm", "expired-client-sid"),
                new Cookie("agri_sso_session", "expired-global-sid")
        });
        when(values.get("agri:sso:session:expired-client-sid")).thenReturn(null);
        when(values.get("agri:sso:session:expired-global-sid")).thenReturn(null);

        assertThat(service.resolve(request, "mdm")).isNull();
    }
}
