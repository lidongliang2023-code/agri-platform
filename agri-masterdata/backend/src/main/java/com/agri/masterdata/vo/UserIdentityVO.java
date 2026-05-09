package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class UserIdentityVO {

    private String identityId;

    private String userId;

    private String identityType;

    private String identityTypeName;

    private String identityName;

    private String identityStatus;

    private String identityStatusName;

    private String identityData;

    private LocalDateTime verifiedTime;

    private LocalDateTime expireTime;

    private LocalDateTime createTime;
}