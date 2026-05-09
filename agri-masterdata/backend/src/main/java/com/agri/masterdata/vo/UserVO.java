package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

@Data
public class UserVO {

    private Long id;

    private String userCode;

    private String username;

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

    private String orgName;

    private String userStatus;

    private String realNameStatus;

    private String riskLevel;

    private Integer creditScore;

    private Date lastLoginTime;

    private String lastLoginIp;

    private Integer loginCount;

    private Integer status;

    private List<Long> roleIds;

    private List<String> roleNames;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String updateBy;

    private LocalDateTime updateTime;

    private String remark;
}
