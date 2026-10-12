package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("org_hierarchy")
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