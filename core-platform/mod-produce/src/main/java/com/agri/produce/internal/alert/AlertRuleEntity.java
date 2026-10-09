package com.agri.produce.internal.alert;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;

/**
 * 告警规则（阈值/持续时长/通知渠道）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_alert_rule")
public class AlertRuleEntity extends ProduceBaseEntity {

    @TableId(value = "rule_id", type = IdType.INPUT)
    private String ruleId;

    /** 农场ID */
    private String farmId;

    /** 地块ID */
    private String plotId;

    /** 设备ID */
    private String deviceId;

    /** 规则名称 */
    private String ruleName;

    /** 监测指标 温度/湿度/土壤水分/CO2 */
    private String metric;

    /** 比较符 gt/lt/ge/le/eq */
    private String operator;

    /** 阈值 */
    private BigDecimal thresholdValue;

    /** 持续时长（分钟） */
    private Integer durationMin;

    /** 告警级别 INFO/WARN/CRITICAL */
    private String alertLevel;

    /** 通知渠道 站内/短信/微信（逗号分隔） */
    private String notifyChannels;

    /** 是否启用 1是 0否 */
    private Integer enabledFlag;

    /** 状态 1正常 0删除 */
    private Integer status;
}
