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
public class QualityStatisticsVO {

    private Double overallScore;
    private Long totalIssues;
    private Long criticalIssues;
    private Long majorIssues;
    private Long minorIssues;
    private Long resolvedIssues;
    private Long highSeverityCount;
    private Long mediumSeverityCount;
    private Long lowSeverityCount;
    private Long resolvedCount;
    private Long pendingCount;
    private Double resolutionRate;
    private List<DomainQuality> domainQualities;
    private List<DomainStatistics> domainStatistics;

    /**
     * 按处理状态的问题数分布（待处理 / 处理中 / 已解决 / 已忽略）。
     *
     * <p>原先只有 pendingCount / resolvedCount 两个标量，仪表盘的"处理状态分布"
     * 需要四个状态齐全，缺两个就只能编 —— 所以改成列表一次给全。</p>
     */
    private List<StatusStatistic> statusStatistics;
    private List<QualityTrend> qualityTrend;
    private List<QualityTrend> trends;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DomainQuality {
        private String domainCode;
        private String domainName;
        private Double score;
        private Long issueCount;
        private Double improvement;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DomainStatistics {
        private String domainCode;
        private String domainName;
        private Long issueCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QualityTrend {
        private String date;
        private Long totalIssues;
        private Long resolvedIssues;
        private Double avgScore;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatusStatistic {
        /** 状态码：pending / processing / resolved / ignored */
        private String status;
        private Long issueCount;
    }
}
