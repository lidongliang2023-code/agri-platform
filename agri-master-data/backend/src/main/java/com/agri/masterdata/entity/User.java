package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.Date;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_user")
public class User extends BaseEntity {

    private String userCode;

    private String username;

    private String password;

    private String realName;

    private String nickName;

    private String userType;

    private String idCardType;

    private String idCardNo;

    private String phone;

    private String email;

    private String avatarUrl;

    private String gender;

    private Date birthday;

    private String province;

    private String city;

    private String district;

    private String address;

    private Long orgId;

    private String userStatus;

    private String realNameStatus;

    private String riskLevel;

    private Integer creditScore;

    private Date lastLoginTime;

    private String lastLoginIp;

    private Integer loginCount;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}
