package com.agri.admin.vo;

import lombok.Data;

@Data
public class DistributionTaskVO {

    private Long id;
    
    private String taskCode;
    
    private String targetSystem;
    
    private String targetSystemName;
    
    private String dataType;
    
    private String dataTypeName;
    
    private String status;
    
    private Integer totalCount;
    
    private Integer successCount;
    
    private Integer failedCount;
    
    private Double delay;
    
    private String tenantId;
    
    private String tenantName;
    
    private String createTime;
    
    private String startTime;
    
    private String endTime;
    
    private String errorMessage;
}