package com.agri.admin.dto;

import lombok.Data;

@Data
public class PermissionStatisticsDTO {

    private String tenantId;
    
    private String roleId;
    
    private String userId;
}