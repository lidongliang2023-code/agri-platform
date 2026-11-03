package com.agri.masterdata.vo;

import com.agri.masterdata.entity.Organization;
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
public class OrganizationVO {

    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    private String orgName;

    @JsonSerialize(using = ToStringSerializer.class)
    private Long parentId;

    private String parentName;

    private String ancestors;

    private String orgCode;

    private String orgType;

    private String orgTypeName;

    private String orgPath;

    /**
     * 法人代表。
     *
     * <p>组织表有 legal_person 列、列表页也有"法人"一列，但 VO 缺这个字段，
     * 那一列一直是空的。</p>
     */
    private String legalPerson;

    /** 组织层级：1 一级 / 2 二级 …，树形展示与详情都会用到 */
    private Integer orgLevel;

    private String contactPerson;

    private String contactPhone;

    private String contactMobile;

    private String province;

    private String city;

    private String district;

    private String address;

    private Integer status;

    private String authStatus;

    private List<OrganizationVO> children;

    private String tenantId;

    /** 统一经营主体名称；历史 T 开头数据从兼容表回填。 */
    private String tenantName;

    /** 是否已关联可用的统一经营主体。 */
    private Boolean subjectLinked;

    /** 是否为未迁移的历史组织数据，只允许查看。 */
    private Boolean legacy;

    /** 当前是否允许在运营端应急维护。 */
    private Boolean editable;

    private Integer childCount;

    private String createBy;

    private LocalDateTime createTime;

    private String updateBy;

    private LocalDateTime updateTime;

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
                .orgPath(org.getOrgPath())
                .legalPerson(org.getLegalPerson())
                .orgLevel(org.getOrgLevel())
                .contactPerson(org.getContactPerson())
                .contactPhone(org.getContactPhone())
                .contactMobile(org.getContactMobile())
                .province(org.getProvince())
                .city(org.getCity())
                .district(org.getDistrict())
                .address(org.getAddress())
                .status(org.getStatus())
                .authStatus(org.getAuthStatus())
                .tenantId(org.getTenantId())
                .createBy(org.getCreateBy())
                .createTime(org.getCreateTime())
                .updateBy(org.getUpdateBy())
                .updateTime(org.getUpdateTime())
                .build();
    }
}
