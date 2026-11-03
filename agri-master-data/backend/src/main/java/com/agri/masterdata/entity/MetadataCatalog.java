package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/** 元数据目录项。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_metadata")
public class MetadataCatalog extends BaseEntity {

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
