package com.agri.admin.vo;

import lombok.Data;

import java.util.List;

@Data
public class TenantDetailVO {

    private Long id;
    
    private String tenantCode;
    
    private String tenantName;
    
    private String tenantType;
    
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
    
    private String currentPackage;
    
    private String expireDate;
    
    private Integer status;
    
    private String createTime;
    
    private QuotaInfo quotaInfo;
    
    private UserOrgStats userOrgStats;
    
    private QualityScore qualityScore;
    
    private List<OperationLog> operationLogs;

    @Data
    public static class QuotaInfo {
        private Integer userLimit;
        private Integer usedUsers;
        private Integer orgLimit;
        private Integer usedOrgs;
        private Integer productLimit;
        private Integer usedProducts;
        private Long storageLimit;
        private Long usedStorage;
        private Integer apiLimit;
        private Integer usedApiToday;
        private Integer alertThreshold;
    }

    @Data
    public static class UserOrgStats {
        private Long totalUsers;
        private Long verifiedUsers;
        private Long pendingUsers;
        private Long totalOrgs;
        private Long verifiedOrgs;
        private Long pendingOrgs;
    }

    @Data
    public static class QualityScore {
        private Double overallScore;
        private Double userMasterData;
        private Double orgMasterData;
        private Double productMasterData;
        private Double permissionMasterData;
    }

    @Data
    public static class OperationLog {
        private String time;
        private String operationType;
        private String operator;
        private String content;
    }
}