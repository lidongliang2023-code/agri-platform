package com.agri.admin.vo;

import lombok.Data;

@Data
public class UserAuditVO {

    private Long id;
    
    private Long userId;
    
    private String username;
    
    private String realName;
    
    private String phone;
    
    private String idCardType;
    
    private String idCardNo;
    
    private String authType;
    
    private String authStatus;
    
    private String authData;
    
    private String createTime;
    
    private String tenantId;
    
    private String tenantName;
}