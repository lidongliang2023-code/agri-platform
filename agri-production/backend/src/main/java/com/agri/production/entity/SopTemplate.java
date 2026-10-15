package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 作业标准（SOP）模板。
 *
 * <p><b>两处 @TableField 指向的是已有旧列（2026-10-15 对齐）：</b>
 * 表 agri_prod_sop_template 里已有 duration / steps，而实体原先声明的是
 * estimated_duration / steps_text —— 语义相同、名字不同。改成映射已有列，
 * 不再新增两个重复列（列名只影响 SQL，接口出参字段名由实体字段名决定，页面零影响）。</p>
 *
 * <p>真正没有对应物的列（category / applicable_crops / applicable_seasons / steps_json /
 * required_materials / version / usage_count）由 schema-patch-sop-page.sql 补上。</p>
 */
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

    @TableField("steps")
    private String stepsText;

    @TableField("duration")
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
