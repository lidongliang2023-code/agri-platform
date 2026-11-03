package com.agri.masterdata.vo;

import com.agri.masterdata.entity.Role;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleVO {

    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    private String roleCode;

    private String roleName;

    private String roleKey;

    /**
     * 角色类型：system 系统内置 / custom 自定义。
     *
     * <p>表里有 role_type 列、页面也按它显示"系统角色/自定义"，但 VO 缺这个字段 ——
     * 结果是每一行都落进"自定义"分支。</p>
     */
    private String roleType;

    private String description;

    private Integer roleSort;

    /**
     * 数据范围：ALL / TENANT / ORG / DEPT / OWNER。
     *
     * <p>类型必须是 String —— PRD《主数据管理模块系统PRD.md》第 1910 行明确写着
     * `data_scope | ENUM | 数据范围：ALL/TENANT/ORG/DEPT/OWNER`，实体 {@code Role.dataScope}
     * 也是 String。原声明成 Integer，于是列表查询一旦真读到数据就抛
     * `Cannot determine value type from string 'ALL'` —— 空表时看不出来，一填数据就 500。</p>
     */
    private String dataScope;

    private String dataScopeName;

    private Integer status;

    private List<Long> menuIds;

    private Boolean isSystem;

    private String ownershipType;

    private String ownershipLabel;

    private String tenantId;

    private String tenantName;

    private String tenantType;

    private Boolean subjectLinked;

    private Boolean legacy;

    private Boolean editable;

    private Long userCount;

    private Long menuCount;

    private Long permissionCount;

    private String createBy;

    private LocalDateTime createTime;

    private String updateBy;

    private LocalDateTime updateTime;

    private String remark;

    public static RoleVO fromEntity(Role role) {
        if (role == null) {
            return null;
        }
        return RoleVO.builder()
                .id(role.getId())
                .roleCode(role.getRoleCode())
                .roleName(role.getRoleName())
                .roleKey(role.getRoleKey())
                .roleType(role.getRoleType())
                .description(role.getDescription())
                .roleSort(role.getSortOrder())
                .dataScope(role.getDataScope())
                .dataScopeName(dataScopeName(role.getDataScope()))
                .status(role.getStatus())
                .isSystem(Integer.valueOf(1).equals(role.getIsSystem()))
                .tenantId(role.getTenantId())
                .createBy(role.getCreateBy())
                .createTime(role.getCreateTime())
                .updateBy(role.getUpdateBy())
                .updateTime(role.getUpdateTime())
                .remark(role.getRemark())
                .build();
    }

    public static String dataScopeName(String dataScope) {
        return switch (dataScope == null ? "" : dataScope) {
            case "ALL" -> "全部数据";
            case "TENANT" -> "主体全部数据";
            case "ORG" -> "本组织数据";
            case "DEPT" -> "本部门数据";
            case "OWNER" -> "本人数据";
            default -> "未设置";
        };
    }
}
