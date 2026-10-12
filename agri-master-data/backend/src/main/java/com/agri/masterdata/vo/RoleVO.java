package com.agri.masterdata.vo;

import com.agri.masterdata.entity.Role;
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

    private String tenantId;

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
                .status(role.getStatus())
                .tenantId(role.getTenantId())
                .createBy(role.getCreateBy())
                .createTime(role.getCreateTime())
                .build();
    }
}
