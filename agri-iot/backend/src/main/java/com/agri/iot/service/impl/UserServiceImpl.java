package com.agri.iot.service.impl;

import com.agri.iot.entity.User;
import com.agri.iot.mapper.UserMapper;
import com.agri.iot.service.IUserService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements IUserService {

    private final BCryptPasswordEncoder passwordEncoder;

    @Override
    public User getByUsername(String username) {
        return getBaseMapper().selectByUsername(username);
    }

    @Override
    public List<User> listByTenant(Long tenantId) {
        return getBaseMapper().selectByTenantId(tenantId);
    }

    @Override
    public List<User> listByRole(String role) {
        return getBaseMapper().selectByRole(role);
    }

    @Override
    @Transactional
    public boolean saveUser(User user) {
        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            user.setPassword(passwordEncoder.encode(user.getPassword()));
        }
        if (user.getStatus() == null) {
            user.setStatus(1);
        }
        if (user.getLoginCount() == null) {
            user.setLoginCount(0);
        }
        return save(user);
    }

    @Override
    @Transactional
    public boolean updateUser(User user) {
        User existing = getById(user.getId());
        if (existing != null) {
            if (user.getPassword() != null && !user.getPassword().isEmpty() && !user.getPassword().equals(existing.getPassword())) {
                user.setPassword(passwordEncoder.encode(user.getPassword()));
            } else {
                user.setPassword(existing.getPassword());
            }
            return updateById(user);
        }
        return false;
    }

    @Override
    @Transactional
    public boolean deleteUser(Long id) {
        return removeById(id);
    }

    @Override
    @Transactional
    public boolean changeStatus(Long id, Integer status) {
        User user = getById(id);
        if (user != null) {
            user.setStatus(status);
            return updateById(user);
        }
        return false;
    }

    @Override
    @Transactional
    public boolean resetPassword(Long id, String newPassword) {
        User user = getById(id);
        if (user != null) {
            user.setPassword(passwordEncoder.encode(newPassword));
            return updateById(user);
        }
        return false;
    }
}