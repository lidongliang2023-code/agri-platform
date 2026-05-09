package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_quality_standard")
public class QualityStandard extends BaseEntity {

    private String standardCode;

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

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}