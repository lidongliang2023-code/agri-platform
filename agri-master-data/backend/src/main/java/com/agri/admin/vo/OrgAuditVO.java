package com.agri.admin.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrgAuditVO {

    private Long id;
    
    private String orgCode;
    
    private String orgName;
    
    private String orgType;
    
    private String legalPerson;
    
    private String contactMobile;
    
    private String creditCode;
    
    private String businessLicense;
    
    private String authStatus;
    
    private String createTime;
    
    private String tenantId;
    
    private String tenantName;
}