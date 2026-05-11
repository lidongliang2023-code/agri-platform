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
@TableName("agri_prod_alert_record")
public class AlertRecord extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("alert_code")
    private String alertCode;

    @TableField("rule_id")
    private Long ruleId;

    @TableField("rule_code")
    private String ruleCode;

    @TableField("alert_type")
    private String alertType;

    @TableField("level")
    private String level;

    @TableField("source_type")
    private String sourceType;

    @TableField("source_id")
    private Long sourceId;

    @TableField("source_name")
    private String sourceName;

    @TableField("farm_id")
    private Long farmId;

    @TableField("plot_id")
    private Long plotId;

    @TableField("title")
    private String title;

    @TableField("content")
    private String content;

    @TableField("value")
    private java.math.BigDecimal value;

    @TableField("unit")
    private String unit;

    @TableField("status")
    private String status;

    @TableField("handle_time")
    private java.time.LocalDateTime handleTime;

    @TableField("handle_user")
    private String handleUser;

    @TableField("handle_result")
    private String handleResult;

    @TableField("remark")
    private String remark;

    @TableField("emergency_plan_id")
    private Long emergencyPlanId;
}