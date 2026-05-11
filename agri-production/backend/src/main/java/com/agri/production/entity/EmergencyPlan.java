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

    @TableField("trigger_condition")
    private String triggerCondition;

    @TableField("alert_level")
    private String alertLevel;

    @TableField("description")
    private String description;

    @TableField("steps")
    private String steps;

    @TableField("steps_json")
    private String stepsJson;

    @TableField("responsible_person")
    private String responsiblePerson;

    @TableField("contact_info")
    private String contactInfo;

    @TableField("related_parties")
    private String relatedParties;

    @TableField("resources_needed")
    private String resourcesNeeded;

    @TableField("is_enabled")
    private Integer isEnabled;

    @TableField("execute_count")
    private Integer executeCount;

    @TableField("last_execute_time")
    private java.time.LocalDateTime lastExecuteTime;
}