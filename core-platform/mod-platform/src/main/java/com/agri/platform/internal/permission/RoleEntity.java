package com.agri.platform.internal.permission;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 角色（全局表）：permissions 为权限码 JSON 数组，如 ["*"] 或 ["trade:read","trade:write"]。
 */
@Data
@TableName("platform_role")
public class RoleEntity {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String code;
    private String name;
    private String permissions;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
