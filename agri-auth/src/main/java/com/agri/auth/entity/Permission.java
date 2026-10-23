package com.agri.auth.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_auth_permission")
public class Permission extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("perm_code")
    private String permCode;

    @TableField("perm_name")
    private String permName;

    @TableField("perm_type")
    private String permType;

    @TableField("parent_id")
    private Long parentId;

    @TableField("path")
    private String path;

    @TableField("component")
    private String component;

    @TableField("sort_order")
    private Integer sortOrder;

    @TableField("icon")
    private String icon;

    @TableField("status")
    private String status;

    @TableField("is_menu")
    private Integer isMenu;
}
