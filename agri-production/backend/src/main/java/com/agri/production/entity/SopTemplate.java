package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_sop_template")
public class SopTemplate extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("template_code")
    private String templateCode;

    @TableField("template_name")
    private String templateName;

    @TableField("category")
    private String category;

    @TableField("task_type")
    private String taskType;

    @TableField("applicable_crops")
    private String applicableCrops;

    @TableField("applicable_seasons")
    private String applicableSeasons;

    @TableField("description")
    private String description;

    @TableField("steps_json")
    private String stepsJson;

    @TableField("steps_text")
    private String stepsText;

    @TableField("estimated_duration")
    private Integer estimatedDuration;

    @TableField("required_tools")
    private String requiredTools;

    @TableField("required_materials")
    private String requiredMaterials;

    @TableField("safety_notes")
    private String safetyNotes;

    @TableField("is_enabled")
    private Integer isEnabled;

    @TableField("version")
    private Integer version;

    @TableField("usage_count")
    private Integer usageCount;
}