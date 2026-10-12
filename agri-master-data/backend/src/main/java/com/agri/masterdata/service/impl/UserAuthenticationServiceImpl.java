package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.UserAuthApplyDTO;
import com.agri.masterdata.dto.UserAuthReviewDTO;
import com.agri.masterdata.entity.User;
import com.agri.masterdata.entity.UserAuthentication;
import com.agri.masterdata.mapper.UserAuthenticationMapper;
import com.agri.masterdata.mapper.UserMapper;
import com.agri.masterdata.service.IUserAuthenticationService;
import com.agri.masterdata.vo.UserAuthenticationVO;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserAuthenticationServiceImpl implements IUserAuthenticationService {

    private final UserAuthenticationMapper userAuthenticationMapper;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    private static final Map<String, String> AUTH_TYPE_MAP = Map.of(
            "real_name", "个人实名认证",
            "enterprise", "企业认证",
            "license", "资质认证"
    );

    private static final Map<String, String> STATUS_MAP = Map.of(
            "pending", "待审核",
            "approved", "已通过",
            "rejected", "已拒绝"
    );

    @Override
    public List<UserAuthenticationVO> listByUserId(String userId) {
        List<UserAuthentication> auths = userAuthenticationMapper.selectByUserId(userId);
        return auths.stream().map(this::convertToVO).collect(Collectors.toList());
    }

    @Override
    public List<UserAuthenticationVO> listByStatus(String authStatus) {
        List<UserAuthentication> auths = userAuthenticationMapper.selectByStatus(authStatus);
        return auths.stream().map(this::convertToVO).collect(Collectors.toList());
    }

    @Override
    public UserAuthenticationVO getById(String authId) {
        UserAuthentication auth = userAuthenticationMapper.selectById(authId);
        if (auth == null) {
            throw new BusinessException("认证记录不存在");
        }
        return convertToVO(auth);
    }

    @Override
    @Transactional
    public void apply(String userId, UserAuthApplyDTO dto) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }

        UserAuthentication existing = userAuthenticationMapper.selectByUserIdAndType(userId, dto.getAuthType());
        if (existing != null && "pending".equals(existing.getAuthStatus())) {
            throw new BusinessException("存在待审核的认证申请");
        }

        String dataJson;
        try {
            dataJson = objectMapper.writeValueAsString(dto.getAuthData());
        } catch (JsonProcessingException e) {
            throw new BusinessException("认证数据序列化失败");
        }

        UserAuthentication auth = new UserAuthentication();
        auth.setUserId(userId);
        auth.setAuthType(dto.getAuthType());
        auth.setAuthStatus("pending");
        auth.setAuthLevel(0);
        auth.setAuthData(dataJson);

        userAuthenticationMapper.insert(auth);
    }

    @Override
    @Transactional
    public void review(String authId, UserAuthReviewDTO dto) {
        UserAuthentication auth = userAuthenticationMapper.selectById(authId);
        if (auth == null) {
            throw new BusinessException("认证记录不存在");
        }
        if (!"pending".equals(auth.getAuthStatus())) {
            throw new BusinessException("只能审核待审核的申请");
        }

        String resultJson;
        try {
            resultJson = objectMapper.writeValueAsString(dto.getAuthResult());
        } catch (JsonProcessingException e) {
            throw new BusinessException("审核结果序列化失败");
        }

        auth.setAuthStatus(dto.getResult());
        auth.setAuthResult(resultJson);
        auth.setVerifiedBy("admin");
        auth.setVerifiedTime(LocalDateTime.now());

        if ("approved".equals(dto.getResult())) {
            auth.setAuthLevel(2);
        }

        userAuthenticationMapper.updateById(auth);
    }

    @Override
    public UserAuthenticationVO getByUserIdAndType(String userId, String authType) {
        UserAuthentication auth = userAuthenticationMapper.selectByUserIdAndType(userId, authType);
        if (auth == null) {
            return null;
        }
        return convertToVO(auth);
    }

    private UserAuthenticationVO convertToVO(UserAuthentication entity) {
        UserAuthenticationVO vo = new UserAuthenticationVO();
        vo.setAuthId(entity.getAuthId());
        vo.setUserId(entity.getUserId());
        vo.setAuthType(entity.getAuthType());
        vo.setAuthTypeName(AUTH_TYPE_MAP.getOrDefault(entity.getAuthType(), entity.getAuthType()));
        vo.setAuthStatus(entity.getAuthStatus());
        vo.setAuthStatusName(STATUS_MAP.getOrDefault(entity.getAuthStatus(), entity.getAuthStatus()));
        vo.setAuthLevel(entity.getAuthLevel());
        vo.setAuthData(parseAuthData(entity.getAuthData()));
        vo.setAuthResult(parseAuthResult(entity.getAuthResult()));
        vo.setVerifiedBy(entity.getVerifiedBy());
        vo.setVerifiedTime(entity.getVerifiedTime());
        vo.setCreateTime(entity.getCreateTime());

        User user = userMapper.selectById(entity.getUserId());
        if (user != null) {
            vo.setUsername(user.getUsername());
        }

        return vo;
    }

    private Map<String, Object> parseAuthData(String data) {
        if (data == null || data.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(data, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            return new HashMap<>();
        }
    }

    private Map<String, Object> parseAuthResult(String data) {
        if (data == null || data.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(data, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            return new HashMap<>();
        }
    }
}