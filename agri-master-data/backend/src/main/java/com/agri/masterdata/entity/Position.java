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
// 表名以 schema.sql 为准（agri_md_ 前缀），详见 Department 上的同类注释。
@TableName("agri_md_position")
public class Position extends BaseEntity {

    @TableId(value = "position_id", type = IdType.ASSIGN_ID)
    private String positionId;

    /**
     * 旧列 pos_code（NOT NULL + 唯一）。
     *
     * <p>这张表同时存在新旧两套列：`pos_code/pos_name/pos_level` 与
     * `position_code/position_name/position_level`。实体原先只映射了新列，
     * 插入时旧列没有值 —— MySQL 直接报 {@code Field 'pos_code' doesn't have a default value}。
     * 写入时两套列必须同时赋值，否则"新代码能读、写不进去"。</p>
     */
    @TableField("pos_code")
    private String posCode;

    @TableField("position_code")
    private String positionCode;

    @TableField("pos_name")
    private String posName;

    @TableField("position_name")
    private String positionName;

    @TableField("dept_id")
    private String deptId;

    @TableField("position_level")
    private Integer positionLevel;

    @TableField("position_desc")
    private String positionDesc;

    @TableField("incumbent_count")
    private Integer incumbentCount;

    @TableField("status")
    private String status;
}
