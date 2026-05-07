package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_role")
public class Role extends BaseEntity {

    private String roleCode;

    private String roleName;

    private String roleKey;

    private Integer roleSort;

    private Integer dataScope;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}
