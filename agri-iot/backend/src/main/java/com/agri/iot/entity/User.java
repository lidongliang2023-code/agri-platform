package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_user")
public class User extends BaseEntity {

    private String username;

    private String password;

    private String realName;

    private String phone;

    private String email;

    private String role;

    private Integer status;

    private String tenantCode;

    private String avatar;

    private String department;

    private LocalDateTime lastLoginTime;

    private String lastLoginIp;

    private Integer loginCount;
}