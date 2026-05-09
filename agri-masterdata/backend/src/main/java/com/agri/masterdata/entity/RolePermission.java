package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("agri_md_role_permission")
public class RolePermission {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("role_id")
    private String roleId;

    @TableField("permission_id")
    private String permissionId;

    @TableField("create_time")
    private LocalDateTime createTime;
}