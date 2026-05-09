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

    private String description;

    private Integer roleSort;

    private Integer dataScope;

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
                .description(role.getDescription())
                .status(role.getStatus())
                .tenantId(role.getTenantId())
                .createBy(role.getCreateBy())
                .createTime(role.getCreateTime())
                .build();
    }
}
