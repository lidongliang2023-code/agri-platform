package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.UserIdentitySaveDTO;
import com.agri.masterdata.entity.User;
import com.agri.masterdata.entity.UserIdentity;
import com.agri.masterdata.mapper.UserIdentityMapper;
import com.agri.masterdata.mapper.UserMapper;
import com.agri.masterdata.service.IUserIdentityService;
import com.agri.masterdata.vo.UserIdentityVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserIdentityServiceImpl implements IUserIdentityService {

    private final UserIdentityMapper userIdentityMapper;
    private final UserMapper userMapper;

    private static final Map<String, String> IDENTITY_TYPE_MAP = Map.of(
            "farmer", "农户",
            "collector", "收购商",
            "wholesaler", "批发商",
            "retailer", "零售商",
            "service_provider", "服务商",
            "government", "政府用户",
            "enterprise", "企业用户",
            "admin", "平台管理员"
    );

    private static final Map<String, String> STATUS_MAP = Map.of(
            "active", "有效",
            "inactive", "无效"
    );

    @Override
    public List<UserIdentityVO> listByUserId(String userId) {
        List<UserIdentity> identities = userIdentityMapper.selectByUserId(userId);
        return identities.stream().map(this::convertToVO).collect(Collectors.toList());
    }

    @Override
    public UserIdentityVO getById(String identityId) {
        UserIdentity identity = userIdentityMapper.selectById(identityId);
        if (identity == null) {
            throw new BusinessException("身份不存在");
        }
        return convertToVO(identity);
    }

    @Override
    @Transactional
    public void save(String userId, UserIdentitySaveDTO dto) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }

        UserIdentity identity = new UserIdentity();
        identity.setUserId(userId);
        identity.setIdentityType(dto.getIdentityType());
        identity.setIdentityName(dto.getIdentityName() != null ? dto.getIdentityName() : IDENTITY_TYPE_MAP.getOrDefault(dto.getIdentityType(), dto.getIdentityType()));
        identity.setIdentityData(dto.getIdentityData());
        identity.setIdentityStatus("active");
        identity.setVerifiedTime(LocalDateTime.now());
        identity.setExpireTime(LocalDateTime.now().plusYears(1));

        userIdentityMapper.insert(identity);
    }

    @Override
    @Transactional
    public void update(String identityId, UserIdentitySaveDTO dto) {
        UserIdentity identity = userIdentityMapper.selectById(identityId);
        if (identity == null) {
            throw new BusinessException("身份不存在");
        }

        if (dto.getIdentityType() != null) {
            identity.setIdentityType(dto.getIdentityType());
        }
        if (dto.getIdentityName() != null) {
            identity.setIdentityName(dto.getIdentityName());
        }
        if (dto.getIdentityData() != null) {
            identity.setIdentityData(dto.getIdentityData());
        }

        userIdentityMapper.updateById(identity);
    }

    @Override
    @Transactional
    public void delete(String identityId) {
        UserIdentity identity = userIdentityMapper.selectById(identityId);
        if (identity == null) {
            throw new BusinessException("身份不存在");
        }

        userIdentityMapper.deleteById(identityId);
    }

    @Override
    @Transactional
    public void switchIdentity(String userId, String identityId) {
        UserIdentity identity = userIdentityMapper.selectById(identityId);
        if (identity == null) {
            throw new BusinessException("身份不存在");
        }
        if (!userId.equals(identity.getUserId())) {
            throw new BusinessException("无权切换该身份");
        }
        if (!"active".equals(identity.getIdentityStatus())) {
            throw new BusinessException("身份状态无效");
        }

        identity.setIdentityStatus("active");
        userIdentityMapper.updateById(identity);
    }

    @Override
    public UserIdentity getByUserIdAndType(String userId, String identityType) {
        LambdaQueryWrapper<UserIdentity> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserIdentity::getUserId, userId)
                .eq(UserIdentity::getIdentityType, identityType);
        return userIdentityMapper.selectOne(wrapper);
    }

    private UserIdentityVO convertToVO(UserIdentity entity) {
        UserIdentityVO vo = new UserIdentityVO();
        vo.setIdentityId(entity.getIdentityId());
        vo.setUserId(entity.getUserId());
        vo.setIdentityType(entity.getIdentityType());
        vo.setIdentityTypeName(IDENTITY_TYPE_MAP.getOrDefault(entity.getIdentityType(), entity.getIdentityType()));
        vo.setIdentityName(entity.getIdentityName());
        vo.setIdentityStatus(entity.getIdentityStatus());
        vo.setIdentityStatusName(STATUS_MAP.getOrDefault(entity.getIdentityStatus(), entity.getIdentityStatus()));
        vo.setIdentityData(entity.getIdentityData());
        vo.setVerifiedTime(entity.getVerifiedTime());
        vo.setExpireTime(entity.getExpireTime());
        vo.setCreateTime(entity.getCreateTime());
        return vo;
    }
}