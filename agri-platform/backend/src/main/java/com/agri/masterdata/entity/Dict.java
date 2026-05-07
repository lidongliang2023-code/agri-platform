package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_dict")
public class Dict extends BaseEntity {

    private String dictName;

    private String dictCode;

    private String dictType;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}
