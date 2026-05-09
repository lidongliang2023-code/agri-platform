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
public class PermissionStatisticsVO {

    private Long totalRoles;
    
    private Long totalPermissions;
    
    private Long totalRoleAssignments;
    
    private Long totalUserRoles;
    
    private Long anomalyCount;
    
    private List<RoleDistribution> roleDistribution;
    
    private List<AnomalyItem> anomalies;
    
    private List<PermissionTrend> trends;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoleDistribution {
        private String roleName;
        private String roleCode;
        private Long userCount;
        private Long permissionCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AnomalyItem {
        private String anomalyType;
        private String description;
        private String severity;
        private String targetId;
        private String targetName;
        private String tenantId;
        private String tenantName;
        private String createTime;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PermissionTrend {
        private String date;
        private Long roleCreations;
        private Long permissionChanges;
        private Long roleAssignments;
    }
}