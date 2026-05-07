package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SupplierVO {

    private Long id;

    private String supplierCode;

    private String supplierName;

    private String supplierType;

    private String supplierTypeName;

    private Long orgId;

    private String orgName;

    private String creditCode;

    private String legalPerson;

    private String contactPerson;

    private String contactPhone;

    private String address;

    private String level;

    private Integer status;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String remark;
}
