package com.agri.admin.dto;

import lombok.Data;

@Data
public class TenantQuotaAdjustDTO {

    private Integer userLimit;
    
    private Integer orgLimit;
    
    private Integer productLimit;
    
    private Long storageLimit;
    
    private Integer apiLimit;
    
    private String reason;
}