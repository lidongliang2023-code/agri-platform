package com.agri.admin.vo;

import lombok.Data;

import java.util.List;

@Data
public class TenantStatisticsVO {

    private Summary summary;
    
    private List<TenantTrend> trends;
    
    private List<TenantRank> rankings;

    @Data
    public static class Summary {
        private Long totalTenants;
        private Long enterpriseTenants;
        private Long individualTenants;
        private Long activeTenants;
        private Long inactiveTenants;
        private Long expiredTenants;
        private Double avgQualityScore;
        private Long totalUsers;
    }

    @Data
    public static class TenantTrend {
        private String date;
        private Long newTenants;
        private Long activeTenants;
        private Long churnTenants;
    }

    @Data
    public static class TenantRank {
        private Integer rank;
        private String tenantId;
        private String tenantName;
        private String tenantType;
        private Long userCount;
        private Double qualityScore;
        private Long dataUpdates;
        private String status;
    }
}