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

        User user = BeanCopyUtils.copy(dto, User.class);
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setTenantId(SecurityUtils.getTenantId());
        user.setCreateBy(SecurityUtils.getUsername());
        user.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        user.setDelFlag(0);
        userMapper.insert(user);
    }

    @Override
    @Transactional
    public void update(Long id, UserUpdateDTO dto) {
        User user = userMapper.selectById(id);
        if (user == null || user.getDelFlag() == 1) {
            throw new BusinessException("用户不存在");
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
}
