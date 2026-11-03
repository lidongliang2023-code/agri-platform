package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 角色 ↔ 权限点授权（{@code agri_md_role_permission}）。
 *
 * <p>列名按表来：{@code role_id} / {@code perm_id} 都是 BIGINT。以前实体写的是
 * {@code permission_id}（那是 2026-10-12 补的 NULL 列），而
 * {@code RoleMapper.xml} 统计「接口权限」读的是 {@code perm_id} ——
 * 两边各读各的，所以角色详情里的接口权限数永远是 0。</p>
 */
@Data
@TableName("agri_md_role_permission")
public class RolePermission {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("role_id")
    private Long roleId;

    @TableField("perm_id")
    private Long permId;

    /** 0=启用（与库里默认值一致） */
    @TableField("status")
    private Integer status;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("create_by")
    private String createBy;
}
