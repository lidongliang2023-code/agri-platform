package com.agri.masterdata.service;

import com.agri.masterdata.entity.UserProfile;
import com.agri.masterdata.vo.UserProfileVO;

import java.util.List;
import java.util.Map;

public interface IUserProfileService {

    List<UserProfileVO> listByUserId(String userId);

    UserProfileVO getById(String profileId);

    UserProfileVO getByUserIdAndType(String userId, String profileType);

    void saveOrUpdate(String userId, String profileType, Map<String, Object> profileData);

    void addTags(String userId, List<String> tags);

    void removeTags(String userId, List<String> tags);

    void updateScores(String userId, Map<String, Object> scores);
}