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
@TableName("department")
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