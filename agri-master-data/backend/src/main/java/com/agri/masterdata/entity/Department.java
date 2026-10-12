package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
// 表名必须以 schema.sql 为准：主数据域的物理表统一带 agri_md_ 前缀。
// 原先写成不带前缀的 department，运行时 MySQL 直接报
// Table 'agri_masterdata.department' doesn't exist —— 表名对不上，业务代码再正确也跑不起来。
@TableName("agri_md_department")
public class Department extends BaseEntity {

    @TableId(value = "dept_id", type = IdType.ASSIGN_ID)
    private String deptId;

    @TableField("dept_code")
    private String deptCode;

    @TableField("dept_name")
    private String deptName;

    @TableField("parent_dept_id")
    private String parentDeptId;

    @TableField("org_id")
    private String orgId;

    @TableField("dept_manager")
    private String deptManager;

    @TableField("contact_phone")
    private String contactPhone;

    @TableField("dept_count")
    private Integer deptCount;

    @TableField("status")
    private String status;
}
