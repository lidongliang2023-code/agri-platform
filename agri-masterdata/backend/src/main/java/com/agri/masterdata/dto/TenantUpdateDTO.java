package com.agri.masterdata.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Date;

@Data
public class TenantUpdateDTO {

    @Size(max = 100, message = "租户名称长度不能超过100")
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

    private String remark;
}