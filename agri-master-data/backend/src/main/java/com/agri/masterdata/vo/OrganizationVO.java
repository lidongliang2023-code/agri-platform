package com.agri.masterdata.vo;

import com.agri.masterdata.entity.Organization;
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
public class OrganizationVO {

    private Long id;

    private String orgName;

    private Long parentId;

    private String ancestors;

    private String orgCode;

    private String orgType;

    private String orgTypeName;

    private String contactPerson;

    private String contactPhone;

    private String address;

    private Integer status;

    private String authStatus;

    private List<OrganizationVO> children;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String remark;

    public static OrganizationVO fromEntity(Organization org) {
        if (org == null) {
            return null;
        }
        return OrganizationVO.builder()
                .id(org.getId())
                .orgName(org.getOrgName())
                .parentId(org.getParentId())
                .ancestors(org.getAncestors())
                .orgCode(org.getOrgCode())
                .orgType(org.getOrgType())
                .contactPerson(org.getContactPerson())
                .contactPhone(org.getContactPhone())
                .address(org.getAddress())
                .status(org.getStatus())
                .authStatus(org.getAuthStatus())
                .tenantId(org.getTenantId())
                .createBy(org.getCreateBy())
                .createTime(org.getCreateTime())
                .build();
    }
}
