package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 作物主数据（页面「作物管理」/ 种养计划的作物下拉）。

 *
 * <p>作物是**租户级**主数据：同一租户共用一套作物，不挂农场 ——
 * 表里的 {@code farm_id} 沿用 {@link BaseEntity} 的通用列但不使用
 * （与 {@code agri_prod_operate_log} 同法），落库时留空。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_crop_info")
public class CropInfo extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 作物编码（业务主键，同租户内唯一，页面 cropCode） */
    @TableField("crop_code")
    private String cropCode;

    /** 作物名称（页面 cropName；计划 / 地块的作物列显示的就是它） */
    @TableField("crop_name")
    private String cropName;

    /** 作物类别（可空，不做枚举校验） */
    @TableField("crop_category")
    private String cropCategory;

    /** 生长周期（天，可空） */
    @TableField("growth_cycle_days")
    private Integer growthCycleDays;

    /** 计量单位（如 kg / 株，可空） */
    @TableField("measurement_unit")
    private String measurementUnit;

    /** 1 启用 / 0 停用（停用后不出现在计划 / 地块的作物下拉里） */
    @TableField("status")
    private Integer status;

    /** 排序号（小的在前） */
    @TableField("sort_no")
    private Integer sortNo;

    /** 备注 */
    @TableField("remark")
    private String remark;
}
