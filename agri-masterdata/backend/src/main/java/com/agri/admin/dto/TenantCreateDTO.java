package com.agri.admin.dto;

import lombok.Data;

@Data
public class TenantCreateDTO {

    private String tenantType;
    
    private String tenantName;
    
    private String contactName;
    
    private String phone;
    
    private String email;
    
    private String province;
    
    private String city;
    
    private String district;
    
    private String address;
    
    private String creditCode;
    
    private String legalPerson;
    
    private Long registeredCapital;
    
    private String businessScope;
    
    private String businessLicenseUrl;
    
    private String packageCode;
    
    private String expireDate;
    
    private String adminUsername;
    
    private String adminPassword;
}