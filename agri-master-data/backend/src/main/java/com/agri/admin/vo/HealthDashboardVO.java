package com.agri.admin.vo;

import lombok.Data;

import java.util.List;

@Data
public class HealthDashboardVO {

    private Double overallScore;
    private List<DomainScore> domainScores;
    private List<ScoreTrend> scoreTrends;
    private List<QualityIssue> topIssues;
    private DataFreshness dataFreshness;

    @Data
    public static class DomainScore {
        private String domainName;
        private String domainCode;
        private Double score;
        private Integer issueCount;
    }

    @Data
    public static class ScoreTrend {
        private String date;
        private Double score;
    }

    @Data
    public static class QualityIssue {
        private String issueType;
        private String domain;
        private String description;
        private String severity;
        private Long count;
    }

    @Data
    public static class DataFreshness {
        private String lastUpdateTime;
        private Long updateCountToday;
        private Double freshnessRate;
    }
}