package com.agri.admin.vo;

import lombok.Data;

@Data
public class QualityIssueVO {

    private Long id;
    
    private String issueCode;
    
    private String issueType;
    
    private String severity;
    
    private String domain;
    
    private String domainCode;
    
    private String description;
    
    private String affectedData;
    
    private String tenantId;
    
    private String tenantName;
    
    private String status;
    
    private String createTime;
    
    private String lastUpdateTime;
    
    private String handler;
}