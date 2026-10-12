package com.agri.admin.vo;

import lombok.Data;

import java.util.List;

@Data
public class DashboardVO {

    private CoreMetrics coreMetrics;
    private DistributionStatus distributionStatus;
    private List<AlertItem> alerts;
    private PendingAudit pendingAudit;
    private QualityDistribution qualityDistribution;

    @Data
    public static class CoreMetrics {
        private Long tenantCount;
        private Long userCount;
        private Long orgCount;
        private Double qualityScore;
        private String tenantCountChange;
        private String userCountChange;
        private String orgCountChange;
        private String qualityScoreChange;
    }

    @Data
    public static class DistributionStatus {
        private Long todayDistribution;
        private Double successRate;
        private Double avgDelay;
        private Long failedCount;
    }

    @Data
    public static class AlertItem {
        private String level;
        private String title;
        private String content;
        private String tenantId;
        private String tenantName;
        private String createTime;
    }

    @Data
    public static class PendingAudit {
        private Long userCertCount;
        private Long orgCertCount;
        private Long standardChangeCount;
        private Long qualityIssueCount;
    }

    @Data
    public static class QualityDistribution {
        private Double userMasterData;
        private Double orgMasterData;
        private Double productMasterData;
        private Double permissionMasterData;
        private Double customerSupplier;
    }
}