package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_organization")
public class Organization extends BaseEntity {

    private String orgCode;

    private String orgName;

    private String orgType;

    private Long parentId;

    private String ancestors;

    private Integer orgLevel;

    private String orgPath;

    private String legalPerson;

    private String contactPerson;

    private String contactPhone;

    private String contactMobile;

    private String province;

    private String city;

    private String district;

    private String address;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private BigDecimal registeredCapital;

    private String businessScope;

    private String businessLicense;

    private String taxNo;

    private String logoUrl;

    private String intro;

    private Integer memberCount;

    private String orgStatus;

    private String riskLevel;

    private String creditLevel;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}
