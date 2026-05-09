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
@TableName("position")
public class Position extends BaseEntity {

    @TableId(value = "position_id", type = IdType.ASSIGN_ID)
    private String positionId;

    @TableField("position_code")
    private String positionCode;

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