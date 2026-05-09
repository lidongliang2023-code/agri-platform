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
}