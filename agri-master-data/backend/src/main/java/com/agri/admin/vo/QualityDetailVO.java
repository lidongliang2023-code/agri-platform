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
public class QualityDetailVO {

    private Long id;
    
    private String issueCode;
    
    private String issueType;
    
    private String severity;
    
    private String domain;
    
    private String domainCode;
    
    private String description;
    
    private String affectedData;
    
    private String affectedCount;
    
    private Integer affectedRecords;
    
    private String tenantId;
    
    private String tenantName;
    
    private String status;
    
    private String createTime;
    
    private String detectedTime;
    
    private String lastUpdateTime;
    
    private String handler;
    
    private String resolver;
    
    private String resolveTime;
    
    private String resolveRemark;
    
    private String remark;
    
    private List<HandleHistory> handleHistories;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HandleHistory {
        private String time;
        private String operator;
        private String action;
        private String remark;
    }
}