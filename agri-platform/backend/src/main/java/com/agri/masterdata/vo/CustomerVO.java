package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CustomerVO {

    private Long id;

    private String customerCode;

    private String customerName;

    private String customerType;

    private String customerTypeName;

    private Long orgId;

    private String orgName;

    private String creditCode;

    private String legalPerson;

    private String contactPhone;

    private String address;

    private String level;

    private Integer status;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String remark;
}
