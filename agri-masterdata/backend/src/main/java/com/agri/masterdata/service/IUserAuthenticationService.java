package com.agri.masterdata.service;

import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.UserAuthApplyDTO;
import com.agri.masterdata.dto.UserAuthReviewDTO;
import com.agri.masterdata.vo.UserAuthenticationVO;

import java.util.List;

public interface IUserAuthenticationService {

    List<UserAuthenticationVO> listByUserId(String userId);

    List<UserAuthenticationVO> listByStatus(String authStatus);

    UserAuthenticationVO getById(String authId);

    void apply(String userId, UserAuthApplyDTO dto);

    void review(String authId, UserAuthReviewDTO dto);

    UserAuthenticationVO getByUserIdAndType(String userId, String authType);
}