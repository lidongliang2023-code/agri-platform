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
public class ProductStatisticsVO {

    private Long totalProducts;
    private Long activeProducts;
    private Long newProducts;
    private Integer categoryCount;
    private Long publishedProducts;
    private Long pendingProducts;
    private Long offlineProducts;
    private Long todayAdded;
    private Long todayUpdated;
    private Double avgQualityScore;
    private List<CategoryStatistics> categoryStatistics;
    private List<TenantProductStats> tenantRanking;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryStatistics {
        private String categoryId;
        private String categoryName;
        private Long productCount;
        private Double avgPrice;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TenantProductStats {
        private String tenantId;
        private String tenantName;
        private Long productCount;
        private Long publishedCount;
    }
}