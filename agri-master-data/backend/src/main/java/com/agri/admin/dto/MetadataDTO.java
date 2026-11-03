package com.agri.admin.dto;

import lombok.Data;

/** 元数据目录入参。 */
@Data
public class MetadataDTO {

    /** BUSINESS / TECHNICAL / MANAGEMENT */
    private String metadataType;

    private String name;

    private String nameEn;

    private String domainName;

    private String dataType;

    /** 是 / 条件必填 / 系统生成 */
    private String required;

    private String sourceTable;

    private String version;

    private String description;

    /** DRAFT / PUBLISHED / DISABLED */
    private String status;
}
