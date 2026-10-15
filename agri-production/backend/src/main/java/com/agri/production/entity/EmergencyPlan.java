package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 应急预案。
 *
 * <p><b>四处 @TableField 指向的是**旧一代列名**（2026-10-15 对齐）：</b>
 * 表 agri_prod_emergency_plan 里已有 level / trigger_conditions / response_steps / resources_required，
 * 而实体原先声明的是 alert_level / trigger_condition / steps / resources_needed —— 四个语义相同、
 * 名字不同的列。这里改成映射到已有的那一列，而不是再 ADD 四个重复列：
 * 列名只影响 SQL，不影响接口出参（JSON 字段名仍由实体字段名决定），
 * 所以改映射对页面零影响，却避免了同一张表里躺着两套同义列。</p>
 *
 * <p>真正没有对应物的 4 列（steps_json / related_parties / execute_count / last_execute_time）
 * 由 schema-patch-alert-page.sql 补上。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_emergency_plan")
public class EmergencyPlan extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("plan_code")
    private String planCode;

    @TableField("plan_name")
    private String planName;

    @TableField("plan_type")
    private String planType;

    @TableField("trigger_conditions")
    private String triggerCondition;

    @TableField("level")
    private String alertLevel;

    @TableField("description")
    private String description;

    @TableField("response_steps")
    private String steps;

    @TableField("steps_json")
    private String stepsJson;

    @TableField("responsible_person")
    private String responsiblePerson;

    @TableField("contact_info")
    private String contactInfo;

    @TableField("related_parties")
    private String relatedParties;

    @TableField("resources_required")
    private String resourcesNeeded;

    @TableField("is_enabled")
    private Integer isEnabled;

    @TableField("execute_count")
    private Integer executeCount;

    @TableField("last_execute_time")
    private java.time.LocalDateTime lastExecuteTime;
}
