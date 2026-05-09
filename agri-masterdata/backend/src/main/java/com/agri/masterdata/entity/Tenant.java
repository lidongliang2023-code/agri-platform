package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.Date;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_tenant")
public class Tenant extends BaseEntity {

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

    private Integer delFlag;

    private String tenantId;
}