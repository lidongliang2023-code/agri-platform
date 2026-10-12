package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_tenant")
public class Tenant extends BaseEntity {

    private String tenantCode;

    private String tenantName;

    private String tenantType;

    private String contactName;

    private String contactPerson;

    private String contactPhone;

    private String contactEmail;

    private String email;

    private String logoUrl;

    private String domain;

    private String province;

    private String city;

    private String district;

    private String address;

    private Integer status;

    private Date expireTime;

    private Integer maxUsers;

    private Integer delFlag;

    private String tenantId;
}