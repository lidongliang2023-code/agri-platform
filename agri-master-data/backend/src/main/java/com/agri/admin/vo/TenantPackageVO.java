package com.agri.admin.vo;

import lombok.Data;

@Data
public class TenantPackageVO {

    private Long id;
    
    private String packageCode;
    
    private String packageName;
    
    private String packageDesc;
    
    private Integer userLimit;
    
    private Integer orgLimit;
    
    private Integer productLimit;
    
    private Long storageLimit;
    
    private Integer apiLimit;
    
    private String serviceLevelDesc;
    
    private Double price;
    
    private Integer duration;
    
    private Integer status;
    
    private String createTime;
}