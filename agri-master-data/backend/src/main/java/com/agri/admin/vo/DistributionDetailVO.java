package com.agri.admin.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DistributionDetailVO {

    private Long id;
    
    private String taskName;
    
    private String taskCode;
    
    private String targetSystem;
    
    private String targetUrl;
    
    private String targetSystemName;
    
    private String dataType;
    
    private String dataTypeName;
    
    private String status;
    
    private Integer totalCount;
    
    private Integer recordCount;
    
    private Integer successCount;
    
    private Integer failedCount;
    
    private Double delay;
    
    private String tenantId;
    
    private String tenantName;
    
    private String createTime;
    
    private String startTime;
    
    private String endTime;
    
    private String errorMessage;
    
    private String scheduleType;
    
    private String scheduleConfig;
    
    private List<DistributionLog> logs;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DistributionLog {
        private String time;
        private String level;
        private String message;
    }
}