package com.agri.masterdata.mapper;

import com.agri.masterdata.dto.UserPageDTO;
import com.agri.masterdata.entity.User;
import com.agri.masterdata.vo.UserVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface UserMapper extends BaseMapper<User> {

    List<UserVO> selectUserPage(@Param("dto") UserPageDTO dto);

    long selectUserCount(@Param("dto") UserPageDTO dto);

    UserVO selectUserById(@Param("id") Long id);

    List<Long> selectRoleIdsByUserId(@Param("userId") Long userId);

    List<String> selectRoleNamesByUserId(@Param("userId") Long userId);

    void deleteUserRoles(@Param("userId") Long userId);

    void insertUserRole(@Param("userId") Long userId, @Param("roleId") Long roleId, @Param("tenantId") String tenantId);

    User selectByUsername(@Param("username") String username);
}
