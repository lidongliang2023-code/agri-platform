package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DataPermissionSaveDTO {

    @NotBlank(message = "角色ID不能为空")
    private String roleId;

    @NotBlank(message = "数据范围不能为空")
    private String dataScope;

    private String customDepts;

    private String dataConditions;

    private String moduleType;
}