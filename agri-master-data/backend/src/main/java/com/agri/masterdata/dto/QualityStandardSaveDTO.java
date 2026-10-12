package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class QualityStandardSaveDTO {

    @NotBlank(message = "标准编码不能为空")
    private String standardCode;

    @NotBlank(message = "标准名称不能为空")
    private String standardName;

    private Long categoryId;

    private String standardType;

    private String attributeCode;

    private String attributeName;

    private String operator;

    private BigDecimal minValue;

    private BigDecimal maxValue;

    private String unit;

    private String reference;

    private Integer status = 1;

    private String remark;
}