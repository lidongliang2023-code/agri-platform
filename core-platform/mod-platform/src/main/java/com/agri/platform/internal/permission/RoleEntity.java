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
    /** 角色说明，用于运营端列表/详情展示 */
    private String description;
    /** enabled / disabled，停用后角色不再参与授权判定 */
    private String status;
    private String permissions;
    /** PLATFORM / BUSINESS / SUBJECT / REGULATORY：单平台领域授权。 */
    private String scopeType;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /** 绑定该角色的用户数（非表字段，列表接口按 platform_user_role 统计后回填） */
    @TableField(exist = false)
    private Long memberCount;
}
