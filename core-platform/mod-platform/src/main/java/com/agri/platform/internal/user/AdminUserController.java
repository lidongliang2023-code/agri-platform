package com.agri.platform.internal.user;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户管理（云管家）：列表 / 创建（含「用户×角色×市场」绑定）/ 启停。
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final PasswordEncoders passwordEncoders;

    public record CreateUserRequest(@NotBlank String username, String nickname, String phone,
                                    @NotBlank String password, @NotNull Long marketId, @NotNull Long roleId) {
    }

    @Data
    public static class UpdateStatusRequest {
        @NotNull
        private Integer status;
    }

    @GetMapping
    public ApiResponse<PageResult<UserEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                    @RequestParam(defaultValue = "10") long size,
                                                    @RequestParam(required = false) String keyword) {
        Page<UserEntity> result = userMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<UserEntity>()
                        .and(keyword != null && !keyword.isBlank(), w -> w
                                .like(UserEntity::getUsername, keyword)
                                .or().like(UserEntity::getNickname, keyword))
                        .orderByDesc(UserEntity::getCreatedAt));
        result.getRecords().forEach(u -> u.setPassword(null));
        return ApiResponse.ok(PageResult.of(result.getRecords(), result.getTotal(), page, size));
    }

    @PostMapping
    public ApiResponse<Long> create(@Valid @RequestBody CreateUserRequest req) {
        Long exists = userMapper.selectCount(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getUsername, req.username()));
        if (exists > 0) {
            throw new BusinessException(ErrorCode.DUPLICATE_KEY, "用户名已存在");
        }
        UserEntity user = new UserEntity();
        user.setUsername(req.username());
        user.setNickname(req.nickname());
        user.setPhone(req.phone());
        user.setPassword(passwordEncoders.encoder().encode(req.password()));
        user.setStatus(1);
        userMapper.insert(user);

        UserRoleEntity binding = new UserRoleEntity();
        binding.setUserId(user.getId());
        binding.setRoleId(req.roleId());
        binding.setMarketId(req.marketId());
        userRoleMapper.insert(binding);
        return ApiResponse.ok(user.getId());
    }

    @PutMapping("/{id}/status")
    public ApiResponse<Void> updateStatus(@PathVariable Long id, @Valid @RequestBody UpdateStatusRequest req) {
        UserEntity user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        user.setStatus(req.getStatus());
        userMapper.updateById(user);
        return ApiResponse.ok();
    }

    /** 密码编码器统一持有 */
    @org.springframework.stereotype.Component
    public static class PasswordEncoders {
        public BCryptPasswordEncoder encoder() {
            return new BCryptPasswordEncoder();
        }
    }
}
