package com.agri.platform.internal.user;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 「用户 × 角色 × 市场」绑定（权限模型四维之一，ADR-005：云管家按市场隔离运营）。
 */
@Data
@TableName("platform_user_role")
public class UserRoleEntity {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long userId;
    private Long roleId;
    private Long marketId;
}
