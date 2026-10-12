package com.agri.masterdata.service;

import com.agri.masterdata.dto.UserIdentitySaveDTO;
import com.agri.masterdata.entity.UserIdentity;
import com.agri.masterdata.vo.UserIdentityVO;

import java.util.List;

public interface IUserIdentityService {

    List<UserIdentityVO> listByUserId(String userId);

    UserIdentityVO getById(String identityId);

    void save(String userId, UserIdentitySaveDTO dto);

    void update(String identityId, UserIdentitySaveDTO dto);

    void delete(String identityId);

    void switchIdentity(String userId, String identityId);

    UserIdentity getByUserIdAndType(String userId, String identityType);
}