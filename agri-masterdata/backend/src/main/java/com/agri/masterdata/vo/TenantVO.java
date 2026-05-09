package com.agri.masterdata.vo;

import lombok.Data;

import java.util.Date;

@Data
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

    private Date createTime;

    private Date updateTime;

    private String remark;
}