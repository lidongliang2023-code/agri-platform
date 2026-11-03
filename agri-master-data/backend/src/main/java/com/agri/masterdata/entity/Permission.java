package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 权限点（{@code agri_md_permission}）—— 按钮级 / API 级授权的最小单位。
 *
 * <p><b>为什么重写这个实体</b>：表里真正在用的列是 {@code id / perm_code / perm_name / perm_type /
 * api_path / http_method / status / del_flag}（{@code perm_code} 还是 NOT NULL UNIQUE），
 * 而本实体以前映射的是 2026-10-12 为"字段对齐"补的那一串全 NULL 列，主键还写成
 * {@code permission_id VARCHAR + ASSIGN_ID}；再叠上继承的 {@code BaseEntity} 会带出
 * {@code deleted}、{@code farm_id} 两个<b>表里根本没有的列</b> —— 结果是谁都写不进去，
 * 两张权限点表一直 0 行，角色详情的「接口权限」也永远显示 0。</p>
 *
 * <p>目录不手工编：由 {@code PermissionPointCatalogService} 从 Spring 的实际端点映射同步，
 * 端点下线时置 {@code del_flag=1}，所以这张表不会与代码漂移。</p>
 */
@Data
@TableName("agri_md_permission")
public class Permission {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 权限编码：同步生成时为「METHOD 路径」，唯一且可反查端点 */
    @TableField("perm_code")
    private String permCode;

    /** 显示名：来自端点的 @Operation summary；没有就退化成 控制器#方法名，不编中文名 */
    @TableField("perm_name")
    private String permName;

    /** API / BUTTON / PAGE（本轮只产 API 级） */
    @TableField("perm_type")
    private String permType;

    @TableField("api_path")
    private String apiPath;

    @TableField("http_method")
    private String httpMethod;

    /** 所属功能模块（同步自控制器 @Tag 名称），矩阵页按它分组 */
    @TableField("module")
    private String module;

    /** 0=启用（与库里 status 默认值一致；本模块 status 0 表示正常，不是"停用"） */
    @TableField("status")
    private Integer status;

    @TableField("del_flag")
    private Integer delFlag;

    /** NULL = 平台级权限点；主体自定义时填主体号 */
    @TableField("tenant_id")
    private String tenantId;

    @TableField("remark")
    private String remark;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;
}
