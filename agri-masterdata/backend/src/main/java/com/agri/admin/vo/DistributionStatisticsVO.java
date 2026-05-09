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
public class DistributionStatisticsVO {

    private Long totalTasks;
    private Long successTasks;
    private Long failedTasks;
    private Long pendingTasks;
    private Long totalDistributions;
    private Long successCount;
    private Long failedCount;
    private Long pendingCount;
    private Double successRate;
    private Double avgDelay;
    private Long todayDistribution;
    private List<TargetSystem> targetSystems;
    private List<DistributionTrend> distributionTrend;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TargetSystem {
        private String systemCode;
        private String systemName;
        private Long totalDistributions;
        private Double successRate;
        private Double avgDelay;
        private String status;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DistributionTrend {
        private String date;
        private Long totalDistributions;
        private Long successCount;
        private Long failedCount;
        private Double avgDelay;
    }
}