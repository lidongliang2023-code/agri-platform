package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class UserAuthenticationVO {

    private String authId;

    private String userId;

    private String username;

    private String authType;

    private String authTypeName;

    private String authStatus;

    private String authStatusName;

    private Integer authLevel;

    private Map<String, Object> authData;

    private Map<String, Object> authResult;

    private String verifiedBy;

    private String verifiedByName;

    private LocalDateTime verifiedTime;

    private LocalDateTime createTime;
}