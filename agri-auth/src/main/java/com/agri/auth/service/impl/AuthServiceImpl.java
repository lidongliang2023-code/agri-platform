package com.agri.auth.service.impl;

import com.agri.auth.entity.User;
import com.agri.auth.mapper.UserMapper;
import com.agri.auth.service.IAuthService;
import com.agri.common.constant.ErrorCode;
import com.agri.common.exception.BusinessException;
import com.agri.common.utils.EncryptUtils;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import cn.dev33.satoken.stp.StpUtil;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
public class AuthServiceImpl implements IAuthService {

    private final UserMapper userMapper;

    public AuthServiceImpl(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Override
    public Map<String, Object> login(String username, String password) {
        User user = userMapper.findByUsername(username);
        if (user == null) {
            user = userMapper.findByPhone(username);
        }

        if (user == null) {
            throw BusinessException.notFound("用户不存在");
        }

        if ("disabled".equals(user.getStatus())) {
            throw BusinessException.forbidden("用户已被禁用");
        }

        String hashedPassword = EncryptUtils.hashPassword(password, user.getSalt());
        if (!hashedPassword.equals(user.getPassword())) {
            throw BusinessException.error(ErrorCode.PASSWORD_ERROR, "密码错误");
        }

        StpUtil.login(user.getId());
        String token = StpUtil.getTokenValue();

        user.setLastLoginTime(LocalDateTime.now());
        user.setLoginCount(user.getLoginCount() != null ? user.getLoginCount() + 1 : 1);
        userMapper.updateById(user);

        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        result.put("user", buildUserInfo(user));
        return result;
    }

    @Override
    public void logout() {
        StpUtil.logout();
    }

    @Override
    public Map<String, Object> register(User user) {
        User existing = userMapper.findByUsername(user.getUsername());
        if (existing != null) {
            throw BusinessException.exists("用户名已存在");
        }

        existing = userMapper.findByPhone(user.getPhone());
        if (existing != null) {
            throw BusinessException.exists("手机号已被注册");
        }

        String salt = EncryptUtils.generateSalt();
        user.setSalt(salt);
        user.setPassword(EncryptUtils.hashPassword(user.getPassword(), salt));
        user.setStatus("active");
        user.setCreateTime(LocalDateTime.now());
        user.setUpdateTime(LocalDateTime.now());
        user.setDeleted(0);
        user.setLoginCount(0);

        userMapper.insert(user);

        StpUtil.login(user.getId());
        String token = StpUtil.getTokenValue();

        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        result.put("user", buildUserInfo(user));
        return result;
    }

    @Override
    public void changePassword(String oldPassword, String newPassword) {
        Long userId = StpUtil.getLoginIdAsLong();
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw BusinessException.notFound("用户不存在");
        }

        String hashedOldPassword = EncryptUtils.hashPassword(oldPassword, user.getSalt());
        if (!hashedOldPassword.equals(user.getPassword())) {
            throw BusinessException.error(ErrorCode.PASSWORD_ERROR, "旧密码错误");
        }

        String salt = EncryptUtils.generateSalt();
        user.setSalt(salt);
        user.setPassword(EncryptUtils.hashPassword(newPassword, salt));
        user.setUpdateTime(LocalDateTime.now());
        userMapper.updateById(user);
    }

    @Override
    public void resetPassword(Long userId, String newPassword) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw BusinessException.notFound("用户不存在");
        }

        String salt = EncryptUtils.generateSalt();
        user.setSalt(salt);
        user.setPassword(EncryptUtils.hashPassword(newPassword, salt));
        user.setUpdateTime(LocalDateTime.now());
        userMapper.updateById(user);
    }

    @Override
    public User getUserInfo(String token) {
        if (!StpUtil.isLogin()) {
            throw BusinessException.unauthorized("未登录");
        }
        Long userId = StpUtil.getLoginIdAsLong();
        return userMapper.selectById(userId);
    }

    @Override
    public String refreshToken(String refreshToken) {
        return StpUtil.getTokenValue();
    }

    @Override
    public void updateUserInfo(User user) {
        Long userId = StpUtil.getLoginIdAsLong();
        User existing = userMapper.selectById(userId);
        if (existing == null) {
            throw BusinessException.notFound("用户不存在");
        }

        existing.setRealName(user.getRealName());
        existing.setPhone(user.getPhone());
        existing.setEmail(user.getEmail());
        existing.setAvatar(user.getAvatar());
        existing.setUpdateTime(LocalDateTime.now());
        userMapper.updateById(existing);
    }

    @Override
    public void deleteUser(Long userId) {
        LambdaUpdateWrapper<User> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(User::getId, userId).set(User::getDeleted, 1);
        userMapper.update(wrapper);
    }

    @Override
    public void lockUser(Long userId) {
        LambdaUpdateWrapper<User> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(User::getId, userId).set(User::getStatus, "disabled");
        userMapper.update(wrapper);
    }

    @Override
    public void unlockUser(Long userId) {
        LambdaUpdateWrapper<User> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(User::getId, userId).set(User::getStatus, "active");
        userMapper.update(wrapper);
    }

    private Map<String, Object> buildUserInfo(User user) {
        Map<String, Object> info = new HashMap<>();
        info.put("id", user.getId());
        info.put("username", user.getUsername());
        info.put("realName", user.getRealName());
        info.put("phone", user.getPhone());
        info.put("email", user.getEmail());
        info.put("avatar", user.getAvatar());
        info.put("roleCode", user.getRoleCode());
        info.put("status", user.getStatus());
        return info;
    }
}
