package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_permission")
public class Permission extends BaseEntity {

    @TableId(value = "permission_id", type = IdType.ASSIGN_ID)
    private String permissionId;

    @TableField("permission_code")
    private String permissionCode;

    @TableField("permission_name")
    private String permissionName;

    @TableField("permission_type")
    private String permissionType;

    @TableField("parent_id")
    private String parentId;

    @TableField("permission_path")
    private String permissionPath;

    @TableField("permission_icon")
    private String permissionIcon;

    @TableField("permission_url")
    private String permissionUrl;

    @TableField("component")
    private String component;

    @TableField("is_leaf")
    private Integer isLeaf;

    @TableField("sort_order")
    private Integer sortOrder;

    @TableField("status")
    private String status;
}