package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
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

    private List<OrganizationVO> children;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String remark;
}
