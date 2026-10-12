package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Date;

@Data
public class TenantSaveDTO {

    @NotBlank(message = "租户编码不能为空")
    @Size(max = 50, message = "租户编码长度不能超过50")
    private String tenantCode;

    @NotBlank(message = "租户名称不能为空")
    @Size(max = 100, message = "租户名称长度不能超过100")
    private String tenantName;

    private String tenantType = "enterprise";

    private String contactPerson;

    private String contactPhone;

    private String contactEmail;

    private String logoUrl;

    private String domain;

    private Integer status = 1;

    private Date expireTime;

    private Integer maxUsers = 100;

    private String remark;
}