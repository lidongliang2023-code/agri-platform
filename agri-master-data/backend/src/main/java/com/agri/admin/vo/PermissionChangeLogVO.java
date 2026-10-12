package com.agri.admin.vo;

import lombok.Data;

@Data
public class PermissionChangeLogVO {

    private Long id;
    
    private String changeType;
    
    private String targetType;
    
    private String targetId;
    
    private String targetName;
    
    private String beforeValue;
    
    private String afterValue;
    
    private String operator;
    
    private String operatorId;
    
    private String createTime;
    
    private String tenantId;
    
    private String tenantName;
    
    private String ipAddress;
}