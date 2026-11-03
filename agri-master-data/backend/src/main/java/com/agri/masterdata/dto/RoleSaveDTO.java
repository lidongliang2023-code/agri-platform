package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RoleSaveDTO {

    @NotBlank(message = "角色编码不能为空")
    @Size(max = 50, message = "角色编码长度不能超过50")
    private String roleCode;

    @NotBlank(message = "角色名称不能为空")
    @Size(max = 50, message = "角色名称长度不能超过50")
    private String roleName;

    @NotBlank(message = "角色标识不能为空")
    @Size(max = 100, message = "角色标识长度不能超过100")
    @Pattern(regexp = "[A-Za-z][A-Za-z0-9:_-]{1,99}", message = "角色标识只能包含字母、数字、冒号、下划线和中划线")
    private String roleKey;

    private String description;

    private String tenantId;

    @Min(value = 0, message = "角色排序不能小于 0")
    private Integer roleSort;

    /** 数据范围：ALL / TENANT / ORG / DEPT / OWNER（与 RoleVO、Role 实体同口径，见 RoleVO 注释） */
    @Pattern(regexp = "ALL|TENANT|ORG|DEPT|OWNER", message = "数据范围必须是 ALL、TENANT、ORG、DEPT 或 OWNER")
    private String dataScope;

    @Min(value = 0, message = "角色状态只能是 0 或 1")
    @Max(value = 1, message = "角色状态只能是 0 或 1")
    private Integer status;

    private String remark;
}
