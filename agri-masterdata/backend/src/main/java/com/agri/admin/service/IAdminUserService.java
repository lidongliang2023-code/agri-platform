package com.agri.admin.service;

import com.agri.admin.dto.UserImportDTO;
import com.agri.admin.vo.UserAuditVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.UserAuthReviewDTO;
import com.agri.masterdata.dto.UserSaveDTO;
import com.agri.masterdata.dto.UserUpdateDTO;
import com.agri.masterdata.vo.UserVO;

public interface IAdminUserService {

    PageResult<UserVO> getUserList(Integer pageNum, Integer pageSize, String username, String phone, String email, String userType, String realNameStatus, String userStatus, String tenantId);

    UserVO getUserDetail(Long id);

    void createUser(UserSaveDTO dto);

    void updateUser(Long id, UserUpdateDTO dto);

    void deleteUser(Long id);

    void updateUserStatus(Long id, String userStatus);

    PageResult<UserAuditVO> getCertAuditList(Integer pageNum, Integer pageSize, String authStatus);

    void reviewCert(Long id, UserAuthReviewDTO dto);

    ApiResponse.BatchResult importUsers(UserImportDTO dto);

    byte[] exportUsers(String userStatus, String tenantId);
}