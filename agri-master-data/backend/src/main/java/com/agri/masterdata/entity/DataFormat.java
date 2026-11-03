package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/** 字段级格式标准。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_data_format")
public class DataFormat extends BaseEntity {

    private String formatCode;

    private String formatName;

    /** string / number / date / boolean / enum */
    private String dataType;

    private String validationRule;

    private Integer maxLength;

    private Integer minLength;

    private String defaultValue;

    private String description;

    /** DRAFT / PUBLISHED / DISABLED */
    private String status;
}
