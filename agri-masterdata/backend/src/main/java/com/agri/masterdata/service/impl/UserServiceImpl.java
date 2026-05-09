package com.agri.masterdata.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.ChangePasswordDTO;
import com.agri.masterdata.dto.UserPageDTO;
import com.agri.masterdata.dto.UserSaveDTO;
import com.agri.masterdata.dto.UserUpdateDTO;
import com.agri.masterdata.entity.User;
import com.agri.masterdata.mapper.UserMapper;
import com.agri.masterdata.service.IUserService;
import com.agri.masterdata.vo.UserVO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements IUserService {

    private final UserMapper userMapper;
    private final BCryptPasswordEncoder passwordEncoder;

    @Override
    public PageResult<UserVO> page(UserPageDTO dto) {
        dto.setPageNum((dto.getPageNum() - 1) * dto.getPageSize());
        List<UserVO> list = userMapper.selectUserPage(dto);
        long count = userMapper.selectUserCount(dto);
        return new PageResult<>(list, count, (long) (dto.getPageNum() / dto.getPageSize() + 1), (long) dto.getPageSize());
    }

    @Override
    public UserVO getById(Long id) {
        return userMapper.selectUserById(id);
    }

    @Override
    @Transactional
    public void save(UserSaveDTO dto) {
        User existing = userMapper.selectByUsername(dto.getUsername());
        if (existing != null) {
            throw new BusinessException("用户名已存在");
        }

        if (dto.getPhone() != null && !dto.getPhone().isEmpty()) {
            existing = userMapper.selectByPhone(dto.getPhone());
            if (existing != null) {
                throw new BusinessException("手机号已被注册");
            }
        }

        if (dto.getEmail() != null && !dto.getEmail().isEmpty()) {
            existing = userMapper.selectByEmail(dto.getEmail());
            if (existing != null) {
                throw new BusinessException("邮箱已被注册");
            }
        }

        User user = BeanCopyUtils.copy(dto, User.class);
        user.setUserCode(generateUserCode());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setTenantId(SecurityUtils.getTenantId());
        user.setCreateBy(SecurityUtils.getUsername());
        user.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        user.setDelFlag(0);
        user.setUserStatus(dto.getUserStatus() != null ? dto.getUserStatus() : "active");
        user.setRealNameStatus(dto.getRealNameStatus() != null ? dto.getRealNameStatus() : "unverified");
        userMapper.insert(user);
    }

    @Override
    @Transactional
    public void update(Long id, UserUpdateDTO dto) {
        User user = userMapper.selectById(id);
        if (user == null || user.getDelFlag() == 1) {
            throw new BusinessException("用户不存在");
        }

        if (dto.getPhone() != null && !dto.getPhone().isEmpty() && !dto.getPhone().equals(user.getPhone())) {
            User existing = userMapper.selectByPhone(dto.getPhone());
            if (existing != null && !existing.getId().equals(id)) {
                throw new BusinessException("手机号已被使用");
            }
        }

        if (dto.getEmail() != null && !dto.getEmail().isEmpty() && !dto.getEmail().equals(user.getEmail())) {
            User existing = userMapper.selectByEmail(dto.getEmail());
            if (existing != null && !existing.getId().equals(id)) {
                throw new BusinessException("邮箱已被使用");
            }
        }

        BeanCopyUtils.copyProperties(dto, user);
        user.setUpdateBy(SecurityUtils.getUsername());
        userMapper.updateById(user);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        User user = userMapper.selectById(id);
        if (user == null || user.getDelFlag() == 1) {
            throw new BusinessException("用户不存在");
        }

        user.setDelFlag(1);
        user.setUpdateBy(SecurityUtils.getUsername());
        userMapper.updateById(user);
    }

    @Override
    @Transactional
    public void resetPassword(Long id) {
        User user = userMapper.selectById(id);
        if (user == null || user.getDelFlag() == 1) {
            throw new BusinessException("用户不存在");
        }

        user.setPassword(passwordEncoder.encode("123456"));
        user.setUpdateBy(SecurityUtils.getUsername());
        userMapper.updateById(user);
    }

    @Override
    @Transactional
    public void changePassword(ChangePasswordDTO dto) {
        Long userId = SecurityUtils.getUserId();
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }

        if (!passwordEncoder.matches(dto.getOldPassword(), user.getPassword())) {
            throw new BusinessException("旧密码不正确");
        }

        user.setPassword(passwordEncoder.encode(dto.getNewPassword()));
        user.setUpdateBy(SecurityUtils.getUsername());
        userMapper.updateById(user);
    }

    @Override
    @Transactional
    public void changeStatus(Long id, Integer status) {
        User user = userMapper.selectById(id);
        if (user == null || user.getDelFlag() == 1) {
            throw new BusinessException("用户不存在");
        }

        user.setStatus(status);
        user.setUpdateBy(SecurityUtils.getUsername());
        userMapper.updateById(user);
    }

    @Override
    @Transactional
    public void assignRoles(Long userId, List<Long> roleIds) {
        userMapper.deleteUserRoles(userId);
        String tenantId = SecurityUtils.getTenantId();
        for (Long roleId : roleIds) {
            userMapper.insertUserRole(userId, roleId, tenantId);
        }
    }

    @Override
    public UserVO getInfo() {
        Long userId = SecurityUtils.getUserId();
        return userMapper.selectUserById(userId);
    }

    @Override
    public User getByUsername(String username) {
        return userMapper.selectByUsername(username);
    }

    @Override
    public User getByPhone(String phone) {
        return userMapper.selectByPhone(phone);
    }

    @Override
    public User getByEmail(String email) {
        return userMapper.selectByEmail(email);
    }

    @Override
    @Transactional
    public void updateLoginInfo(Long userId, String loginIp) {
        userMapper.updateLoginInfo(userId, new Date(), loginIp);
    }

    @Override
    @Transactional
    public void updateUserStatus(Long userId, String userStatus) {
        userMapper.updateUserStatus(userId, userStatus);
    }

    @Override
    @Transactional
    public void updateRealNameStatus(Long userId, String realNameStatus) {
        userMapper.updateRealNameStatus(userId, realNameStatus);
    }

    private String generateUserCode() {
        return "U" + System.currentTimeMillis() + String.format("%04d", (int) (Math.random() * 10000));
    }

    @Override
    @Transactional
    public void mergeUsers(List<Long> sourceUserIds, Long targetUserId) {
        User targetUser = userMapper.selectById(targetUserId);
        if (targetUser == null || targetUser.getDelFlag() == 1) {
            throw new BusinessException("目标用户不存在");
        }

        for (Long sourceUserId : sourceUserIds) {
            if (sourceUserId.equals(targetUserId)) {
                throw new BusinessException("不能将用户合并到自己");
            }

            User sourceUser = userMapper.selectById(sourceUserId);
            if (sourceUser == null || sourceUser.getDelFlag() == 1) {
                throw new BusinessException("源用户不存在");
            }

            sourceUser.setDelFlag(1);
            sourceUser.setUpdateBy(SecurityUtils.getUsername());
            userMapper.updateById(sourceUser);
        }
    }

    @Override
    @Transactional
    public void splitUser(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null || user.getDelFlag() == 1) {
            throw new BusinessException("用户不存在");
        }

        User newUser = new User();
        newUser.setUserCode(generateUserCode());
        newUser.setUsername(user.getUsername() + "_split");
        newUser.setPassword(passwordEncoder.encode("123456"));
        newUser.setRealName(user.getRealName());
        newUser.setPhone(user.getPhone() != null ? user.getPhone() + "_split" : null);
        newUser.setEmail(user.getEmail() != null ? user.getEmail().replace("@", "_split@") : null);
        newUser.setTenantId(user.getTenantId());
        newUser.setCreateBy(SecurityUtils.getUsername());
        newUser.setStatus(1);
        newUser.setDelFlag(0);
        newUser.setUserStatus("active");
        newUser.setRealNameStatus("unverified");
        userMapper.insert(newUser);
    }
}
