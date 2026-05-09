package com.agri.masterdata.dto;

import lombok.Data;

@Data
public class ProductAttributeUpdateDTO {

    private Long categoryId;

    private String attributeCode;

    private String attributeName;

    private String attributeType;

    private String unit;

    private String options;

    private Integer sortOrder;

    private Integer isRequired;

    private Integer isUnique;

    private Integer status;

    private String remark;
}