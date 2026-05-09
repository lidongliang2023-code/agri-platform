package com.agri.admin.service.impl;

import com.agri.admin.dto.UserImportDTO;
import com.agri.admin.service.IAdminUserService;
import com.agri.admin.vo.UserAuditVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.UserAuthReviewDTO;
import com.agri.masterdata.dto.UserSaveDTO;
import com.agri.masterdata.dto.UserUpdateDTO;
import com.agri.masterdata.entity.*;
import com.agri.masterdata.mapper.*;
import com.agri.masterdata.service.IUserService;
import com.agri.masterdata.vo.UserVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements IAdminUserService {

    private final IUserService userService;
    private final UserMapper userMapper;
    private final UserAuthenticationMapper userAuthenticationMapper;
    private final TenantMapper tenantMapper;

    @Override
    public PageResult<UserVO> getUserList(Integer pageNum, Integer pageSize, String username, String phone, String email, String userType, String realNameStatus, String userStatus, String tenantId) {
        IPage<User> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        
        if (username != null && !username.isEmpty()) {
            wrapper.like(User::getUsername, username);
        }
        if (phone != null && !phone.isEmpty()) {
            wrapper.like(User::getPhone, phone);
        }
        if (email != null && !email.isEmpty()) {
            wrapper.like(User::getEmail, email);
        }
        if (userType != null && !userType.isEmpty()) {
            wrapper.eq(User::getUserType, userType);
        }
        if (realNameStatus != null && !realNameStatus.isEmpty()) {
            wrapper.eq(User::getRealNameStatus, realNameStatus);
        }
        if (userStatus != null && !userStatus.isEmpty()) {
            wrapper.eq(User::getUserStatus, userStatus);
        }
        if (tenantId != null && !tenantId.isEmpty()) {
            wrapper.eq(User::getTenantId, tenantId);
        }
        
        page = userMapper.selectPage(page, wrapper);
        
        List<UserVO> records = new ArrayList<>();
        for (User user : page.getRecords()) {
            records.add(userService.convertToVO(user));
        }
        
        return new PageResult<>(records, page.getTotal(), pageNum, pageSize);
    }

    @Override
    public UserVO getUserDetail(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        return userService.convertToVO(user);
    }

    @Override
    public void createUser(UserSaveDTO dto) {
        userService.save(dto);
    }

    @Override
    public void updateUser(Long id, UserUpdateDTO dto) {
        userService.update(id, dto);
    }

    @Override
    public void deleteUser(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        user.setStatus(-1);
        userMapper.updateById(user);
    }

    @Override
    public void updateUserStatus(Long id, String userStatus) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        user.setUserStatus(userStatus);
        userMapper.updateById(user);
    }

    @Override
    public PageResult<UserAuditVO> getCertAuditList(Integer pageNum, Integer pageSize, String authStatus) {
        IPage<UserAuthentication> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<UserAuthentication> wrapper = new LambdaQueryWrapper<>();
        
        if (authStatus != null && !authStatus.isEmpty()) {
            wrapper.eq(UserAuthentication::getAuthStatus, authStatus);
        }
        
        page = userAuthenticationMapper.selectPage(page, wrapper);
        
        List<UserAuditVO> records = new ArrayList<>();
        for (UserAuthentication auth : page.getRecords()) {
            UserAuditVO vo = new UserAuditVO();
            vo.setId(auth.getId());
            try {
                vo.setUserId(auth.getUserId() != null ? Long.parseLong(auth.getUserId()) : null);
            } catch (NumberFormatException e) {
                vo.setUserId(null);
            }
            vo.setAuthType(auth.getAuthType());
            vo.setAuthStatus(auth.getAuthStatus());
            vo.setAuthData(auth.getAuthData());
            vo.setCreateTime(auth.getCreateTime() != null ? auth.getCreateTime().toString() : null);
            
            User user = userMapper.selectById(auth.getUserId());
            if (user != null) {
                vo.setUsername(user.getUsername());
                vo.setRealName(user.getRealName());
                vo.setPhone(user.getPhone());
                vo.setIdCardType(user.getIdCardType());
                vo.setIdCardNo(user.getIdCardNo());
                vo.setTenantId(user.getTenantId());
                
                if (user.getTenantId() != null && !user.getTenantId().isEmpty()) {
                    try {
                        Tenant tenant = tenantMapper.selectById(Long.parseLong(user.getTenantId()));
                        if (tenant != null) {
                            vo.setTenantName(tenant.getTenantName());
                        }
                    } catch (NumberFormatException e) {
                    }
                }
            }
            
            records.add(vo);
        }
        
        return new PageResult<>(records, page.getTotal(), pageNum, pageSize);
    }

    @Override
    @Transactional
    public void reviewCert(Long id, UserAuthReviewDTO dto) {
        UserAuthentication auth = userAuthenticationMapper.selectById(id);
        if (auth == null) {
            throw new BusinessException("认证记录不存在");
        }
        
        auth.setAuthStatus(dto.getAuthStatus());
        auth.setAuditNote(dto.getAuditNote());
        auth.setAuditBy("admin");
        auth.setAuditTime(LocalDateTime.now());
        userAuthenticationMapper.updateById(auth);
        
        if ("approved".equals(dto.getAuthStatus())) {
            User user = userMapper.selectById(auth.getUserId());
            if (user != null) {
                user.setRealNameStatus("verified");
                userMapper.updateById(user);
            }
        }
    }

    @Override
    @Transactional
    public ApiResponse.BatchResult importUsers(UserImportDTO dto) {
        int successCount = 0;
        int failCount = 0;
        List<String> failMessages = new ArrayList<>();
        
        for (UserImportDTO.UserImportItem item : dto.getUsers()) {
            try {
                User user = new User();
                user.setUserCode("U" + System.currentTimeMillis());
                user.setUsername(item.getUsername());
                user.setPassword(userService.encodePassword(item.getPassword()));
                user.setRealName(item.getRealName());
                user.setPhone(item.getPhone());
                user.setEmail(item.getEmail());
                user.setUserType(item.getUserType());
                user.setIdCardType(item.getIdCardType());
                user.setIdCardNo(item.getIdCardNo());
                user.setProvince(item.getProvince());
                user.setCity(item.getCity());
                user.setDistrict(item.getDistrict());
                user.setAddress(item.getAddress());
                user.setTenantId(dto.getTenantId() != null ? dto.getTenantId().toString() : null);
                user.setUserStatus("active");
                user.setRealNameStatus("unverified");
                user.setStatus(0);
                
                userMapper.insert(user);
                successCount++;
            } catch (Exception e) {
                failCount++;
                failMessages.add(item.getUsername() + ": " + e.getMessage());
            }
        }
        
        return new ApiResponse.BatchResult(successCount, failCount, String.join("; ", failMessages));
    }

    @Override
    public byte[] exportUsers(String userStatus, String tenantId) {
        return new byte[0];
    }
}