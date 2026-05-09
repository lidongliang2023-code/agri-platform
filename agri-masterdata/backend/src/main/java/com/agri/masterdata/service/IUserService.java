package com.agri.masterdata.service;

import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.ChangePasswordDTO;
import com.agri.masterdata.dto.UserPageDTO;
import com.agri.masterdata.dto.UserSaveDTO;
import com.agri.masterdata.dto.UserUpdateDTO;
import com.agri.masterdata.entity.User;
import com.agri.masterdata.vo.UserVO;

import java.util.List;

public interface IUserService {

    PageResult<UserVO> page(UserPageDTO dto);

    UserVO getById(Long id);

    void save(UserSaveDTO dto);

    void update(Long id, UserUpdateDTO dto);

    void delete(Long id);

    void resetPassword(Long id);

    void changePassword(ChangePasswordDTO dto);

    void changeStatus(Long id, Integer status);

    void assignRoles(Long id, List<Long> roleIds);

    UserVO getInfo();

    User getByUsername(String username);

    User getByPhone(String phone);

    User getByEmail(String email);

    void updateLoginInfo(Long userId, String loginIp);

    void updateUserStatus(Long userId, String userStatus);

    void updateRealNameStatus(Long userId, String realNameStatus);

    void mergeUsers(List<Long> sourceUserIds, Long targetUserId);

    void splitUser(Long userId);

    UserVO convertToVO(User user);

    String encodePassword(String password);
}
