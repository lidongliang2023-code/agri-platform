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
public class CustomerStatisticsVO {

    private Long totalCustomers;
    private Long activeCustomers;
    private Long inactiveCustomers;
    private Long todayAdded;
    private Long totalSuppliers;
    private Long activeSuppliers;
    private Long verifiedSuppliers;
    private Long todaySuppliersAdded;
    private List<TenantCustomerStats> tenantRanking;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TenantCustomerStats {
        private String tenantId;
        private String tenantName;
        private Long customerCount;
        private Long supplierCount;
    }
}