package com.agri.platform.internal.sso;

import com.agri.core.infra.security.JwtUtil;
import com.agri.core.infra.security.RefreshCookieSupport;
import com.agri.core.infra.security.TokenRevocationService;
import com.agri.core.infra.security.TokenService;
import com.agri.platform.internal.auth.AuthService;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** 所有统一退出入口共用：先验证凭据定位账号，再吊销各端凭据。 */
@Service
@RequiredArgsConstructor
public class GlobalLogoutService {
    private final SsoSessionService sessions;
    private final AuthService auth;
    private final TokenService tokens;
    private final RefreshCookieSupport cookies;
    private final AuthorizationCodeService codes;
    private final JwtUtil jwt;
    private final TokenRevocationService revocations;

    public void logout(HttpServletRequest request, HttpServletResponse response,
                       String clientId, String bodyRefreshToken) {
        String refresh = clientId == null ? cookies.read(request) : cookies.readForClient(request, clientId);
        if (refresh == null) {
            refresh = bodyRefreshToken;
        }
        Long userId = null;
        if (!"GET".equalsIgnoreCase(request.getMethod())) {
            String authorization = request.getHeader("Authorization");
            if (authorization != null && authorization.startsWith("Bearer ")) {
                userId = bearerUserId(request);
                // 不允许失效或伪造的显式凭据回退为浏览器中另一个账号。
                if (userId == null) throw new BusinessException(ErrorCode.UNAUTHORIZED);
            } else {
                userId = tokens.userIdOf(refresh);
            }
        }
        if (userId == null) {
            long[] session = sessions.resolve(request, clientId);
            userId = session == null ? null : session[0];
        }
        if (userId != null) {
            // 必须先检查 Cookie 归属，再删除 Redis 中的刷新令牌，否则无法区分其他账号。
            cookies.clearForUser(response, request, userId, tokens::userIdOf);
            sessions.destroyAllForUser(userId, request, response);
            codes.revokeAllForUser(userId);
            auth.revokeAllSessions(userId);
        } else {
            // 幂等退出：只有失效凭据时也正常结束，不按客户端自报账号执行吊销。
            sessions.destroy(request, response, clientId);
            cookies.clearForClient(response, clientId);
        }
    }

    private Long bearerUserId(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            return null;
        }
        try {
            Claims claims = jwt.parse(header.substring(7));
            return revocations.isRevoked(claims.getId()) ? null : Long.valueOf(claims.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
