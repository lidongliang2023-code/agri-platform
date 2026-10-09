package com.agri.platform.internal.user;

import com.agri.platform.api.dto.UserDTO;
import com.agri.platform.api.facade.UserFacade;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 用户中心 OHS 门面实现（internal 层）。
 */
@Service
@RequiredArgsConstructor
public class UserFacadeImpl implements UserFacade {

    private final UserMapper userMapper;

    @Override
    public UserDTO findById(Long userId) {
        UserEntity user = userMapper.selectById(userId);
        return user == null ? null
                : new UserDTO(user.getId(), user.getUsername(), user.getNickname(), user.getPhone(), user.getStatus());
    }

    @Override
    public boolean existsActive(Long userId) {
        return userMapper.selectCount(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getId, userId)
                .eq(UserEntity::getStatus, 1)) > 0;
    }
}
