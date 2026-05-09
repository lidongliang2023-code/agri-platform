package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class DictSaveDTO {

    @NotBlank(message = "字典名称不能为空")
    @Size(max = 100, message = "字典名称长度不能超过100")
    private String dictName;

    @NotBlank(message = "字典编码不能为空")
    @Size(max = 100, message = "字典编码长度不能超过100")
    private String dictCode;

    private String dictType;

    private Integer status;

    private String remark;
}
