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

    /** 接口级权限点数（由端点映射同步）；与 totalPermissions（页面级）分列，避免两个数互相解释不了 */
    private Long totalApiPoints;
    
    private Long totalRoleAssignments;
    
    private Long totalUserRoles;
    
    private Long anomalyCount;

    /** 上次扫描时间（yyyy-MM-dd HH:mm:ss）；从未扫描过时为 null，页面显示"尚未扫描"而不是编一个。 */
    private String lastScanAt;
    
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
        /** 归属主体名称：本模块没有主体名的权威源（成员以用户中心为准），拿不到就留 null，页面回退显示 tenantId。 */
        private String tenantName;
        /** 最近一次仍成立的时间（不是"造出来的发现时间"） */
        private String createTime;
        /** 命中它的规则编码，审计要能回到规则表复核口径 */
        private String ruleCode;
        /** OPEN / RESOLVED */
        private String status;
        /** 第一次发现的时间，重复扫描不会把它推到当下 */
        private String firstSeen;
        /** 对象类型：USER / ROLE_MENU / USER_ROLE / ROLE_MENU_DUP */
        private String targetType;
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