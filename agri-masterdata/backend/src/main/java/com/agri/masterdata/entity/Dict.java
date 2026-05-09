package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_dict")
public class Dict extends BaseEntity {

    private String dictName;

    private String dictCode;

    private String dictType;

    private String description;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}
