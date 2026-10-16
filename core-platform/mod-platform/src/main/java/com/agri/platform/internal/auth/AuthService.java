package com.agri.platform.internal.auth;

import com.agri.core.infra.security.JwtUtil;
import com.agri.core.infra.security.TokenRevocationService;
import com.agri.core.infra.security.TokenService;
import com.agri.core.infra.web.MarketContext;
import com.agri.platform.internal.auth.dto.LoginRequest;
import com.agri.platform.internal.auth.dto.LoginVO;
import com.agri.platform.internal.auth.dto.UserVO;
import com.agri.platform.internal.auth.dto.AuthOutcome;
import com.agri.platform.internal.permission.RoleEntity;
import com.agri.platform.internal.permission.RoleMapper;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.platform.internal.user.UserRoleEntity;
import com.agri.platform.internal.user.UserRoleMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 认证服务：JWT 短时效访问令牌 + Redis 服务端刷新令牌（一次性旋转）。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;
    private final JwtUtil jwtUtil;
    private final TokenService tokenService;
    private final TokenRevocationService revocationService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    // 认证结果：身份与市场，**不含任何令牌**。
    // SSO 授权码流程里「认证」与「换票」是两个时刻（V2.0 第 5.2 节 ③④ 与 ⑥⑦）：前者在 SSO 域发生，
    // 后者在子系统拿 code 回来换取时发生。因此把凭据校验单独抽出来，认证那一刻不下发任何令牌。
    public record AuthenticatedUser(Long userId, Long marketId) {
    }

    /**
     * 只做凭据校验，不下发令牌。
     *
     * @param request 登录请求
     * @return 认证通过的身份与市场
     */
    public AuthenticatedUser authenticate(LoginRequest request) {
        // 账号标识二选一：username 优先，其次 phone（2026-10-16 加手机号登录）。
        // 两个 @NotBlank 校验从 DTO 挪到这里 —— 两个字段都可能缺，注解判不了"至少一个"；
        // password 也要显式判空：BCrypt 的 matches 对 null 明文会 NPE，不能靠它兜。
        String username = request.username() == null ? null : request.username().trim();
        String phone = request.phone() == null ? null : request.phone().trim();
        if (request.password() == null || request.password().isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "密码不能为空");
        }
        if ((username == null || username.isEmpty()) && (phone == null || phone.isEmpty())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写用户名或手机号");
        }
        LambdaQueryWrapper<UserEntity> query = new LambdaQueryWrapper<>();
        if (username != null && !username.isEmpty()) {
            query.eq(UserEntity::getUsername, username);
        } else {
            query.eq(UserEntity::getPhone, phone);
        }
        UserEntity user = userMapper.selectOne(query);
        if (user == null || !passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BusinessException(ErrorCode.USER_OR_PASSWORD_ERROR);
        }
        if (user.getStatus() == null || user.getStatus() != 1) {
            throw new BusinessException(ErrorCode.USER_DISABLED);
        }
        Long marketId = request.marketId() == null ? 1L : request.marketId();
        return new AuthenticatedUser(user.getId(), marketId);
    }

    /**
     * 账号密码登录（自有登录页仍在用）。
     *
     * @param request 登录请求
     * @return 响应体 + 待写入 HttpOnly Cookie 的刷新令牌
     */
    public AuthOutcome login(LoginRequest request) {
        AuthenticatedUser user = authenticate(request);
        return issueTokens(user.userId(), user.marketId());
    }

    /**
     * 用刷新令牌换一组新令牌（服务端一次性旋转，旧刷新令牌随即失效）。
     *
     * @param refreshToken 刷新令牌（由 Controller 从 HttpOnly Cookie 或请求体取得）
     * @return 响应体 + 新的刷新令牌
     */
    public AuthOutcome refresh(String refreshToken) {
        long[] ids = tokenService.consume(refreshToken);
        UserEntity user = userMapper.selectById(ids[0]);
        if (user == null || user.getStatus() == null || user.getStatus() != 1) {
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID);
        }
        return buildLogin(user, ids[1]);
    }

    /**
     * 登出：吊销该用户**全部**刷新令牌与全部在有效期内的访问令牌
     * （V2.0 第 5.4 节「删除/吊销该用户所有子系统的 Refresh Token，并将各 Access Token jti 加入黑名单」）。
     *
     * <p>只吊销手里这一枚是不够的：用户在手机、另一台电脑、另一个子系统上登录过，
     * 那些会话必须一起下线，否则"退出登录"只是当前这台浏览器的错觉。</p>
     *
     * @param refreshToken 本次登出携带的刷新令牌（用于定位用户）；为空或已失效时无法定位用户，只清当前会话
     */
    public void logout(String refreshToken) {
        Long userId = null;
        if (refreshToken != null && !refreshToken.isBlank()) {
            userId = tokenService.revoke(refreshToken);
        }
        if (userId == null) {
            // 取不到用户：登录本就在过期/伪造令牌状态下登出，无需再做全端吊销
            return;
        }
        int refreshRevoked = tokenService.revokeAllForUser(userId);
        int accessRevoked = revocationService.revokeAllForUser(userId);
        log.info("登出全端联动：用户 {} 吊销刷新令牌 {} 枚、访问令牌 {} 枚", userId, refreshRevoked, accessRevoked);
    }

    public UserVO me() {
        MarketContext.Session session = MarketContext.get();
        UserEntity user = userMapper.selectById(session.getUserId());
        if (user == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return new UserVO(user.getId(), user.getUsername(), user.getNickname(), session.getRoles());
    }

    // 为指定用户签发一组令牌 —— 登录与 SSO 换票（/api/v1/sso/token）共用这一条路径。
    // 刻意共用：否则 SSO 那条路会漏掉 jti 登记、刷新令牌索引、角色查询等步骤，
    // 而漏掉的表现是「登出后它还能用」这类很难查的问题。
    public AuthOutcome issueTokens(Long userId, Long marketId) {
        UserEntity user = userMapper.selectById(userId);
        if (user == null || user.getStatus() == null || user.getStatus() != 1) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return buildLogin(user, marketId);
    }

    private AuthOutcome buildLogin(UserEntity user, Long marketId) {
        List<String> roles = roleCodesOf(user.getId(), marketId);
        JwtUtil.IssuedAccessToken issued =
                jwtUtil.issueAccessToken(user.getId(), user.getUsername(), marketId, roles);
        // 登记 jti：不登记的话，这枚令牌在"全端登出"时无法被找到并拉黑
        revocationService.recordIssued(issued.jti(), user.getId(), issued.expiresAtMillis());
        String refreshToken = tokenService.issueRefreshToken(user.getId(), marketId);
        LoginVO body = new LoginVO(issued.token(), jwtUtil.accessTtlSeconds(),
                new UserVO(user.getId(), user.getUsername(), user.getNickname(), roles));
        return new AuthOutcome(body, refreshToken);
    }

    private List<String> roleCodesOf(Long userId, Long marketId) {
        List<UserRoleEntity> bindings = userRoleMapper.selectList(new LambdaQueryWrapper<UserRoleEntity>()
                .eq(UserRoleEntity::getUserId, userId)
                .eq(UserRoleEntity::getMarketId, marketId));
        if (bindings.isEmpty()) {
            return List.of();
        }
        return roleMapper.selectBatchIds(bindings.stream().map(UserRoleEntity::getRoleId).toList())
                .stream().map(RoleEntity::getCode).toList();
    }
}
