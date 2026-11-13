package com.agri.platform.internal.sso;

import com.agri.core.infra.security.*;
import com.agri.platform.internal.auth.AuthService;
import com.agri.platform.internal.auth.AuthController;
import com.agri.platform.internal.merchant.ActiveMerchantService;
import com.agri.platform.internal.uc.AccountPolicyService;
import com.agri.shared.exception.BusinessException;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.*;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Duration;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 使用真实退出、令牌、会话服务，Redis 操作用内存替身验证多账号多客户端状态。 */
class GlobalLogoutServiceTest {
    StringRedisTemplate redis;
    Map<String,String> data;
    Map<String,Set<String>> sets;
    Map<String,Map<String,Double>> sorted;
    ValueOperations<String,String> values;
    SetOperations<String,String> setOps;
    ZSetOperations<String,String> zOps;
    SsoSessionService sessions;
    TokenService tokens;
    TokenRevocationService revocations;
    AuthorizationCodeService codes;
    RefreshCookieSupport cookies;
    AuthService auth;
    JwtUtil jwt;
    GlobalLogoutService logout;
    SsoProperties properties;
    MockHttpServletRequest request;
    MockHttpServletResponse response;
    @BeforeEach @SuppressWarnings("unchecked")
    void setup() {
        data=new HashMap<>();sets=new HashMap<>();sorted=new HashMap<>();
        redis=mock(StringRedisTemplate.class);values=mock(ValueOperations.class);
        setOps=mock(SetOperations.class);zOps=mock(ZSetOperations.class);
        when(redis.opsForValue()).thenReturn(values);when(redis.opsForSet()).thenReturn(setOps);
        when(redis.opsForZSet()).thenReturn(zOps);
        when(values.get(anyString())).thenAnswer(i->data.get(i.getArgument(0)));
        doAnswer(i->{data.put(i.getArgument(0),i.getArgument(1));return null;})
            .when(values).set(anyString(),anyString(),any(Duration.class));
        when(redis.hasKey(anyString())).thenAnswer(i->data.containsKey(i.getArgument(0)));
        when(redis.delete(anyString())).thenAnswer(i->{String k=i.getArgument(0);boolean exists=data.containsKey(k)||sets.containsKey(k)||sorted.containsKey(k);data.remove(k);sets.remove(k);sorted.remove(k);return exists;});
        when(setOps.members(anyString())).thenAnswer(i->new HashSet<>(sets.getOrDefault(i.getArgument(0),Set.of())));
        when(setOps.add(anyString(),any(String[].class))).thenAnswer(i->{String k=i.getArgument(0);Object[] args=i.getArguments();for(int n=1;n<args.length;n++)sets.computeIfAbsent(k,x->new HashSet<>()).add((String)args[n]);return 1L;});
        when(setOps.remove(anyString(),any(Object[].class))).thenAnswer(i->{Set<String> s=sets.get(i.getArgument(0));if(s!=null){Object[] a=i.getArguments();for(int n=1;n<a.length;n++)s.remove(a[n]);}return 1L;});
        when(zOps.range(anyString(),anyLong(),anyLong())).thenAnswer(i->new HashSet<>(sorted.getOrDefault(i.getArgument(0),Map.of()).keySet()));
        when(zOps.score(anyString(),anyString())).thenAnswer(i->sorted.getOrDefault(i.getArgument(0),Map.of()).get(i.getArgument(1)));
        when(redis.execute(any(RedisScript.class),anyList())).thenAnswer(i->{List<String> keys=i.getArgument(1);return data.remove(keys.get(0));});
        properties=new SsoProperties();JwtProperties jp=new JwtProperties();jwt=new JwtUtil(jp);
        tokens=new TokenService(redis,jp);revocations=new TokenRevocationService(redis);
        cookies=new RefreshCookieSupport(jp);
        ReflectionTestUtils.setField(cookies,"cookieName","agri_refresh_token");
        ReflectionTestUtils.setField(cookies,"cookiePath","/api/v1/auth");
        ReflectionTestUtils.setField(cookies,"sameSite","Lax");
        sessions=new SsoSessionService(redis,mock(AccountPolicyService.class),properties,mock(ActiveMerchantService.class));
        codes=new AuthorizationCodeService(redis,properties);
        auth=new AuthService(null,null,null,jwt,tokens,revocations);
        logout=new GlobalLogoutService(sessions,auth,tokens,cookies,codes,jwt,revocations);
        request=new MockHttpServletRequest("GET","/api/v1/sso/logout");response=new MockHttpServletResponse();
    }
    void session(long user,String sid) {data.put("agri:sso:session:"+sid,user+":1");sets.computeIfAbsent("agri:sso:user-sessions:"+user,k->new HashSet<>()).add(sid);data.put("agri:sso:session-meta:"+sid,"metadata");}
    String access(long user,String id) {JwtUtil.IssuedAccessToken issued=jwt.issueAccessToken(user,"test",1L,List.of());sorted.computeIfAbsent("agri:jwt:issued:"+user,k->new HashMap<>()).put(issued.jti(),(double)issued.expiresAtMillis());return issued.token();}
    void assertRevoked(String token){assertThat(revocations.isRevoked(jwt.parse(token).getId())).isTrue();}
    @Test void navigationLogoutRevokesAllClientTokensWithoutRefreshCookie(){
        session(101,"global");session(101,"ai");session(101,"remote-device");
        String a=access(101,"ai"),b=access(101,"trade");String ra=tokens.issueRefreshToken(101L,1L),rb=tokens.issueRefreshToken(101L,2L);
        request.setCookies(new Cookie("agri_sso_session","global"),new Cookie("agri_sso_session_ai-ops","ai"));
        logout.logout(request,response,"ai-ops",null);
        assertRevoked(a);assertRevoked(b);assertThat(tokens.userIdOf(ra)).isNull();assertThat(tokens.userIdOf(rb)).isNull();
        assertThat(data).doesNotContainKeys("agri:sso:session:global","agri:sso:session:ai","agri:sso:session:remote-device","agri:sso:session-meta:remote-device");
        assertThat(sessions.resolve(request,"ai-ops")).isNull();
    }
    @Test void postLogoutUsesSessionWhenRefreshCookieIsOutOfPath(){
        session(101,"global");String a=access(101,"ai");request.setMethod("POST");request.setCookies(new Cookie("agri_sso_session","global"));
        logout.logout(request,response,null,null);assertRevoked(a);
    }
    @Test void clientSessionWinsAndOtherAccountRemainsValid(){
        session(101,"ai");session(202,"global");String a=access(101,"ai"),b=access(202,"mdm");String rb=tokens.issueRefreshToken(202L,1L);
        request.setCookies(new Cookie("agri_sso_session_ai-ops","ai"),new Cookie("agri_sso_session","global"),new Cookie("agri_refresh_token_mdm",rb));
        logout.logout(request,response,"ai-ops",null);assertRevoked(a);assertThat(revocations.isRevoked(jwt.parse(b).getId())).isFalse();
        assertThat(tokens.userIdOf(rb)).isEqualTo(202L);assertThat(sessions.resolve(request)).containsExactly(202L,1L);
        assertThat(response.getHeaders("Set-Cookie")).noneMatch(h->h.startsWith("agri_sso_session=")||h.startsWith("agri_refresh_token_mdm="));
    }
    @Test void authPostUsesClientRefreshNotOtherGlobalAccount(){
        session(202,"global");String a=access(101,"ai"),b=access(202,"mdm");String ra=tokens.issueRefreshToken(101L,1L);
        request.setMethod("POST");request.setCookies(new Cookie("agri_sso_session","global"),new Cookie("agri_refresh_token_ai-ops",ra));
        logout.logout(request,response,"ai-ops",null);assertRevoked(a);assertThat(revocations.isRevoked(jwt.parse(b).getId())).isFalse();assertThat(sessions.resolve(request)).containsExactly(202L,1L);
    }
    @Test void validBearerAllowsLogoutWithoutCookies(){
        String a=access(101,"ai");String refresh=tokens.issueRefreshToken(101L,1L);request.setMethod("POST");request.addHeader("Authorization","Bearer "+a);
        logout.logout(request,response,"ai-ops",null);assertRevoked(a);assertThat(tokens.userIdOf(refresh)).isNull();
    }
    @Test void forgedBearerAndClientReportedUserCannotRevokeOthers(){
        String a=access(101,"ai");request.setMethod("POST");request.addHeader("Authorization","Bearer forged");request.addHeader("X-User-Id","101");
        assertThatThrownBy(()->logout.logout(request,response,"ai-ops",null)).isInstanceOf(BusinessException.class);assertThat(revocations.isRevoked(jwt.parse(a).getId())).isFalse();
    }
    @Test void pendingAuthorizationCodesCannotBeExchangedAfterLogout(){
        session(101,"global");String code=codes.issue(101,1,"ai-ops","http://localhost:8116/sso/callback",null,null);
        request.setCookies(new Cookie("agri_sso_session","global"));logout.logout(request,response,null,null);
        assertThatThrownBy(()->codes.consume(code)).isInstanceOf(BusinessException.class);
    }
    @Test void otherAccountPendingAuthorizationCodeStillWorks(){
        session(101,"global");String code=codes.issue(202,1,"mdm","http://localhost:8080/sso/callback",null,null);
        request.setCookies(new Cookie("agri_sso_session","global"));logout.logout(request,response,null,null);
        assertThat(codes.consume(code).userId()).isEqualTo(202L);
    }
    @Test void repeatedLogoutIsIdempotent(){
        session(101,"global");request.setCookies(new Cookie("agri_sso_session","global"));logout.logout(request,response,null,null);
        assertThatCode(()->logout.logout(request,response,null,null)).doesNotThrowAnyException();
    }
    @Test void clearsSameAccountRefreshCookiesAndKeepsOtherAccount(){
        session(101,"global");String ra=tokens.issueRefreshToken(101L,1L),rb=tokens.issueRefreshToken(202L,1L);
        request.setCookies(new Cookie("agri_sso_session","global"),new Cookie("agri_refresh_token_ai-ops",ra),new Cookie("agri_refresh_token_mdm",rb));
        logout.logout(request,response,null,null);
        assertThat(response.getHeaders("Set-Cookie")).anyMatch(h->h.startsWith("agri_refresh_token_ai-ops=")&&h.contains("Max-Age=0"));
        assertThat(response.getHeaders("Set-Cookie")).noneMatch(h->h.startsWith("agri_refresh_token_mdm="));
    }
    @Test void authControllerUsesGlobalLogoutService(){
        String ra=tokens.issueRefreshToken(101L,1L);String a=access(101,"trade");request.setMethod("POST");request.addHeader("X-Sso-Client","trade");request.setCookies(new Cookie("agri_refresh_token_trade",ra));
        new AuthController(auth,logout,cookies,properties).logout(null,request,response);assertRevoked(a);assertThat(tokens.userIdOf(ra)).isNull();
    }
    @Test void bearerWinsOverAnotherAccountsRefreshAndGlobalCookies(){
        session(202,"global");String a=access(101,"trade"),b=access(202,"mdm");
        String rb=tokens.issueRefreshToken(202L,1L);
        request.setMethod("POST");request.addHeader("Authorization","Bearer "+a);
        request.setCookies(new Cookie("agri_sso_session","global"),new Cookie("agri_refresh_token",rb));
        logout.logout(request,response,null,null);
        assertRevoked(a);assertThat(revocations.isRevoked(jwt.parse(b).getId())).isFalse();
        assertThat(tokens.userIdOf(rb)).isEqualTo(202L);assertThat(sessions.resolve(request)).containsExactly(202L,1L);
    }
    @Test void invalidExplicitBearerCannotFallBackToOtherAccountCookies(){
        session(202,"global");String b=access(202,"mdm");String rb=tokens.issueRefreshToken(202L,1L);
        request.setMethod("POST");request.addHeader("Authorization","Bearer forged");
        request.setCookies(new Cookie("agri_sso_session","global"),new Cookie("agri_refresh_token",rb));
        assertThatThrownBy(()->logout.logout(request,response,null,null)).isInstanceOf(BusinessException.class);
        assertThat(revocations.isRevoked(jwt.parse(b).getId())).isFalse();assertThat(tokens.userIdOf(rb)).isEqualTo(202L);
    }

    @Test void completedLogoutRedirectDoesNotRevokeAnotherAccount(){
        session(202,"global");String b=access(202,"mdm");
        request.setCookies(new Cookie("agri_sso_session","global"));
        SsoController controller=mock(SsoController.class,CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(controller,"properties",properties);
        var redirect=controller.logoutComplete("trade");
        assertThat(redirect.getStatusCode().value()).isEqualTo(302);
        assertThat(redirect.getHeaders().getLocation().toString()).isEqualTo(properties.getClients().get("trade").get(0)+"?logout=1");
        assertThat(revocations.isRevoked(jwt.parse(b).getId())).isFalse();
        assertThat(sessions.resolve(request)).containsExactly(202L,1L);
        assertThatThrownBy(()->controller.logoutComplete("unknown-client")).isInstanceOf(BusinessException.class);
    }

    @Test void completionEndpointPassesThroughRealAuthenticationFilter() throws Exception {
        var filter=new com.agri.platform.internal.auth.JwtAuthFilter(jwt,revocations,
            mock(com.agri.platform.internal.permission.UserPermissionService.class));
        var incoming=new MockHttpServletRequest("GET","/api/v1/sso/logout/complete");
        var outgoing=new MockHttpServletResponse();
        var called=new java.util.concurrent.atomic.AtomicBoolean(false);
        filter.doFilter(incoming,outgoing,(req,res)->called.set(true));
        assertThat(called.get()).isTrue();
    }

}
