package com.agri.admin.vo;

import lombok.Data;

import java.util.List;

@Data
public class TenantStatisticsVO {

    private Summary summary;
    
    private List<TenantTrend> trends;
    
    private List<TenantRank> rankings;

    /** 租户类型分布（按 agri_md_tenant.tenant_type 实际取值统计，不只企业/个人两种）。 */
    private List<NameCount> tenantTypes;

    /** 地域分布（按 agri_md_tenant.province 统计）。 */
    private List<NameCount> regions;

    /** 通用"名称 + 数量"对，供分布类图表使用。 */
    @Data
    public static class NameCount {
        private String name;
        private Long count;

        public NameCount() {
        }

        public NameCount(String name, Long count) {
            this.name = name;
            this.count = count;
        }
    }

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
        /** 区间内的活跃租户数：没有租户活跃度日志表，恒为 null，页面应显示"未接入"。 */
        private Long activeTenants;
        /** 区间内的流失租户数：没有租户状态变更历史，恒为 null。 */
        private Long churnTenants;
    }

    @Data
    public static class TenantRank {
        private Integer rank;
        private String tenantId;
        private String tenantName;
        private String tenantType;
        private Long userCount;
        /** 该租户下的组织数（真值，按 agri_md_organization.tenant_id 统计）。 */
        private Long orgCount;
        /** 质量得分：没有"按租户汇总主数据质量得分"的表，恒为 null。 */
        private Double qualityScore;
        /** 数据更新次数：没有按租户统计变更次数的表，恒为 null。 */
        private Long dataUpdates;
        private String status;
    }
}
