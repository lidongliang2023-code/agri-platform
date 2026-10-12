package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PositionSaveDTO {

    @NotBlank(message = "岗位编码不能为空")
    private String positionCode;

    @NotBlank(message = "岗位名称不能为空")
    private String positionName;

    @NotBlank(message = "所属部门不能为空")
    private String deptId;

    private Integer positionLevel;

    private String positionDesc;
}