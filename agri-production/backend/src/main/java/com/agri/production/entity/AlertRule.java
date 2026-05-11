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
@TableName("agri_prod_alert_rule")
public class AlertRule extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("rule_code")
    private String ruleCode;

    @TableField("rule_name")
    private String ruleName;

    @TableField("alert_type")
    private String alertType;

    @TableField("level")
    private String level;

    @TableField("source_type")
    private String sourceType;

    @TableField("source_id")
    private Long sourceId;

    @TableField("condition_expression")
    private String conditionExpression;

    @TableField("threshold_min")
    private java.math.BigDecimal thresholdMin;

    @TableField("threshold_max")
    private java.math.BigDecimal thresholdMax;

    @TableField("unit")
    private String unit;

    @TableField("description")
    private String description;

    @TableField("is_enabled")
    private Integer isEnabled;

    @TableField("notify_users")
    private String notifyUsers;

    @TableField("notify_methods")
    private String notifyMethods;

    @TableField("remind_interval")
    private Integer remindInterval;

    @TableField("auto_handle")
    private Integer autoHandle;

    @TableField("handle_script")
    private String handleScript;
}