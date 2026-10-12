package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ProductAttributeSaveDTO {

    private Long categoryId;

    @NotBlank(message = "属性编码不能为空")
    private String attributeCode;

    @NotBlank(message = "属性名称不能为空")
    private String attributeName;

    private String attributeType = "string";

    private String unit;

    private String options;

    private Integer sortOrder = 0;

    private Integer isRequired = 0;

    private Integer isUnique = 0;

    private Integer status = 1;

    private String remark;
}