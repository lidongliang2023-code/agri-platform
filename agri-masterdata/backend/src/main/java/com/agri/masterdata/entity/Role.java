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

    private String roleType;

    private Long parentId;

    private Integer roleLevel;

    private String roleDesc;

    private String dataScope;

    private String roleStatus;

    private Integer isSystem;

    private Integer sortOrder;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}
