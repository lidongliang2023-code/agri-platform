package com.agri.masterdata.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RoleUpdateDTO {

    @Size(max = 50, message = "角色名称长度不能超过50")
    private String roleName;

    @Size(max = 100, message = "角色标识长度不能超过100")
    private String roleKey;

    private Integer roleSort;

    private Integer dataScope;

    private Integer status;

    private String remark;
}
