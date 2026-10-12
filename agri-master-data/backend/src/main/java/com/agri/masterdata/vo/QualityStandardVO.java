package com.agri.masterdata.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class QualityStandardVO {

    private Long id;

    private String standardCode;

    private String standardName;

    private Long categoryId;

    private String categoryName;

    private String standardType;

    private String attributeCode;

    private String attributeName;

    private String operator;

    private BigDecimal minValue;

    private BigDecimal maxValue;

    private String unit;

    private String reference;

    private Integer status;

    private String remark;
}