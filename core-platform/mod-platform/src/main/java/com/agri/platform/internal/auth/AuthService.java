package com.agri.platform.internal.auth;

import com.agri.core.infra.security.JwtUtil;
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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 认证服务：JWT 短时效访问令牌 + Redis 服务端刷新令牌（一次性旋转）。
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;
    private final JwtUtil jwtUtil;
    private final TokenService tokenService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    /**
     * 账号密码登录。
     *
     * @param request 登录请求
     * @return 响应体 + 待写入 HttpOnly Cookie 的刷新令牌
     */
    public AuthOutcome login(LoginRequest request) {
        UserEntity user = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getUsername, request.username()));
        if (user == null || !passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BusinessException(ErrorCode.USER_OR_PASSWORD_ERROR);
        }
        if (user.getStatus() == null || user.getStatus() != 1) {
            throw new BusinessException(ErrorCode.USER_DISABLED);
        }
        Long marketId = request.marketId() == null ? 1L : request.marketId();
        return buildLogin(user, marketId);
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

    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            tokenService.revoke(refreshToken);
        }
    }

    public UserVO me() {
        MarketContext.Session session = MarketContext.get();
        UserEntity user = userMapper.selectById(session.getUserId());
        if (user == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return new UserVO(user.getId(), user.getUsername(), user.getNickname(), session.getRoles());
    }

    private AuthOutcome buildLogin(UserEntity user, Long marketId) {
        List<String> roles = roleCodesOf(user.getId(), marketId);
        String accessToken = jwtUtil.createAccessToken(user.getId(), user.getUsername(), marketId, roles);
        String refreshToken = tokenService.issueRefreshToken(user.getId(), marketId);
        LoginVO body = new LoginVO(accessToken, jwtUtil.accessTtlSeconds(),
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
