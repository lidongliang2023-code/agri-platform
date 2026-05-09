package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("agri_md_user_role")
public class UserRole {

    private Long id;

    private Long userId;

    private Long roleId;

    private String tenantId;
}
