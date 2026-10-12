package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.masterdata.entity.UserProfile;
import com.agri.masterdata.mapper.UserProfileMapper;
import com.agri.masterdata.service.IUserProfileService;
import com.agri.masterdata.vo.UserProfileVO;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserProfileServiceImpl implements IUserProfileService {

    private final UserProfileMapper userProfileMapper;
    private final ObjectMapper objectMapper;

    private static final Map<String, String> PROFILE_TYPE_MAP = Map.of(
            "basic", "基础画像",
            "business", "经营画像",
            "behavior", "行为画像"
    );

    @Override
    public List<UserProfileVO> listByUserId(String userId) {
        List<UserProfile> profiles = userProfileMapper.selectByUserId(userId);
        return profiles.stream().map(this::convertToVO).collect(Collectors.toList());
    }

    @Override
    public UserProfileVO getById(String profileId) {
        UserProfile profile = userProfileMapper.selectById(profileId);
        if (profile == null) {
            throw new BusinessException("画像不存在");
        }
        return convertToVO(profile);
    }

    @Override
    public UserProfileVO getByUserIdAndType(String userId, String profileType) {
        UserProfile profile = userProfileMapper.selectByUserIdAndType(userId, profileType);
        if (profile == null) {
            return null;
        }
        return convertToVO(profile);
    }

    @Override
    @Transactional
    public void saveOrUpdate(String userId, String profileType, Map<String, Object> profileData) {
        UserProfile existing = userProfileMapper.selectByUserIdAndType(userId, profileType);

        String dataJson;
        try {
            dataJson = objectMapper.writeValueAsString(profileData);
        } catch (JsonProcessingException e) {
            throw new BusinessException("数据序列化失败");
        }

        if (existing != null) {
            existing.setProfileData(dataJson);
            existing.setUpdateTime(LocalDateTime.now());
            userProfileMapper.updateById(existing);
        } else {
            UserProfile profile = new UserProfile();
            profile.setUserId(userId);
            profile.setProfileType(profileType);
            profile.setProfileData(dataJson);
            profile.setTags("[]");
            profile.setScoreData("{}");
            profile.setUpdateTime(LocalDateTime.now());
            userProfileMapper.insert(profile);
        }
    }

    @Override
    @Transactional
    public void addTags(String userId, List<String> tags) {
        UserProfile profile = userProfileMapper.selectByUserIdAndType(userId, "basic");
        if (profile == null) {
            profile = new UserProfile();
            profile.setUserId(userId);
            profile.setProfileType("basic");
            profile.setProfileData("{}");
            profile.setTags("[]");
            profile.setScoreData("{}");
            profile.setUpdateTime(LocalDateTime.now());
            userProfileMapper.insert(profile);
        }

        List<String> existingTags = parseTags(profile.getTags());
        Set<String> tagSet = new LinkedHashSet<>(existingTags);
        tagSet.addAll(tags);

        try {
            profile.setTags(objectMapper.writeValueAsString(new ArrayList<>(tagSet)));
        } catch (JsonProcessingException e) {
            throw new BusinessException("标签序列化失败");
        }
        profile.setUpdateTime(LocalDateTime.now());
        userProfileMapper.updateById(profile);
    }

    @Override
    @Transactional
    public void removeTags(String userId, List<String> tags) {
        UserProfile profile = userProfileMapper.selectByUserIdAndType(userId, "basic");
        if (profile == null) {
            return;
        }

        List<String> existingTags = parseTags(profile.getTags());
        existingTags.removeAll(tags);

        try {
            profile.setTags(objectMapper.writeValueAsString(existingTags));
        } catch (JsonProcessingException e) {
            throw new BusinessException("标签序列化失败");
        }
        profile.setUpdateTime(LocalDateTime.now());
        userProfileMapper.updateById(profile);
    }

    @Override
    @Transactional
    public void updateScores(String userId, Map<String, Object> scores) {
        UserProfile profile = userProfileMapper.selectByUserIdAndType(userId, "basic");
        if (profile == null) {
            profile = new UserProfile();
            profile.setUserId(userId);
            profile.setProfileType("basic");
            profile.setProfileData("{}");
            profile.setTags("[]");
            profile.setScoreData("{}");
            profile.setUpdateTime(LocalDateTime.now());
            userProfileMapper.insert(profile);
        }

        Map<String, Object> existingScores = parseScoreData(profile.getScoreData());
        existingScores.putAll(scores);

        try {
            profile.setScoreData(objectMapper.writeValueAsString(existingScores));
        } catch (JsonProcessingException e) {
            throw new BusinessException("评分数据序列化失败");
        }
        profile.setUpdateTime(LocalDateTime.now());
        userProfileMapper.updateById(profile);
    }

    private UserProfileVO convertToVO(UserProfile entity) {
        UserProfileVO vo = new UserProfileVO();
        vo.setProfileId(entity.getProfileId());
        vo.setUserId(entity.getUserId());
        vo.setProfileType(entity.getProfileType());
        vo.setProfileTypeName(PROFILE_TYPE_MAP.getOrDefault(entity.getProfileType(), entity.getProfileType()));
        vo.setProfileData(parseProfileData(entity.getProfileData()));
        vo.setTags(parseTags(entity.getTags()));
        vo.setScoreData(parseScoreData(entity.getScoreData()));
        vo.setUpdateTime(entity.getUpdateTime());
        vo.setCreateTime(entity.getCreateTime());
        return vo;
    }

    private Map<String, Object> parseProfileData(String data) {
        if (data == null || data.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(data, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            return new HashMap<>();
        }
    }

    private List<String> parseTags(String tags) {
        if (tags == null || tags.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(tags, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            return new ArrayList<>();
        }
    }

    private Map<String, Object> parseScoreData(String data) {
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