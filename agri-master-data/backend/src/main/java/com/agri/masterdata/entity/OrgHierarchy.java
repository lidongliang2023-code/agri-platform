package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
// 表名以 schema.sql 为准（agri_md_ 前缀），详见 Department 上的同类注释。
@TableName("agri_md_org_hierarchy")
public class OrgHierarchy {

    @TableId(value = "hierarchy_id", type = IdType.ASSIGN_ID)
    private String hierarchyId;

    @TableField("org_id")
    private String orgId;

    @TableField("parent_org_id")
    private String parentOrgId;

    @TableField("ancestor_org_id")
    private String ancestorOrgId;

    @TableField("depth")
    private Integer depth;

    @TableField("path")
    private String path;
}
