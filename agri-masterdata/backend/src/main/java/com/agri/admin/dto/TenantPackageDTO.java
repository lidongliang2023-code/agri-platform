package com.agri.admin.dto;

import lombok.Data;

@Data
public class TenantPackageDTO {

    private String packageCode;
    
    private String packageName;
    
    private String packageDesc;
    
    private Integer userLimit;
    
    private Integer orgLimit;
    
    private Integer productLimit;
    
    private Long storageLimit;
    
    private Integer apiLimit;
    
    private Integer serviceLevel;
    
    private Double price;
    
    private Integer duration;
}