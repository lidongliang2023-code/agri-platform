package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SupplierSaveDTO {

    @NotBlank(message = "供应商编码不能为空")
    @Size(max = 50, message = "供应商编码长度不能超过50")
    private String supplierCode;

    @NotBlank(message = "供应商名称不能为空")
    @Size(max = 200, message = "供应商名称长度不能超过200")
    private String supplierName;

    private String shortName;

    private String supplierType;

    private Long orgId;

    private String tenantId;

    @Size(max = 50, message = "统一社会信用代码长度不能超过50")
    private String creditCode;

    @Size(max = 50, message = "法人代表长度不能超过50")
    private String legalPerson;

    @Size(max = 50, message = "联系人长度不能超过50")
    private String contactPerson;

    @Size(max = 50, message = "联系人姓名长度不能超过50")
    private String contactName;

    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String contactPhone;

    @Size(max = 255, message = "地址长度不能超过255")
    private String address;

    private String level;

    private Integer status;

    private String remark;
}
