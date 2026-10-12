package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("agri_md_data_permission")
public class DataPermission {

    @TableId(value = "dp_id", type = IdType.ASSIGN_ID)
    private String dpId;

    @TableField("role_id")
    private String roleId;

    @TableField("data_scope")
    private String dataScope;

    @TableField("custom_depts")
    private String customDepts;

    @TableField("data_conditions")
    private String dataConditions;

    @TableField("module_type")
    private String moduleType;

    @TableField("create_time")
    private LocalDateTime createTime;
}