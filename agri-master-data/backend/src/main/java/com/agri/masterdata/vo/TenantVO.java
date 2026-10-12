package com.agri.masterdata.vo;

import com.agri.masterdata.entity.Tenant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantVO {

    private Long id;

    private String tenantCode;

    private String tenantName;

    private String tenantType;

    private String contactPerson;

    private String contactPhone;

    private String contactEmail;

    private String logoUrl;

    private String domain;

    private Integer status;

    private Date expireTime;

    private Integer maxUsers;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    private String remark;

    public static TenantVO fromEntity(Tenant tenant) {
        if (tenant == null) {
            return null;
        }
        return TenantVO.builder()
                .id(tenant.getId())
                .tenantCode(tenant.getTenantCode())
                .tenantName(tenant.getTenantName())
                .tenantType(tenant.getTenantType())
                .contactPerson(tenant.getContactName())
                .contactPhone(tenant.getContactPhone())
                .contactEmail(tenant.getEmail())
                .status(tenant.getStatus())
                .createTime(tenant.getCreateTime())
                .updateTime(tenant.getUpdateTime())
                .build();
    }
}