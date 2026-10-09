package com.agri.produce.internal.alert;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 告警记录（规则触发后的处置闭环）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_alert_info")
public class AlertInfoEntity extends ProduceBaseEntity {

    @TableId(value = "alert_id", type = IdType.INPUT)
    private String alertId;

    /** 农场ID */
    private String farmId;

    /** 地块ID */
    private String plotId;

    /** 设备ID */
    private String deviceId;

    /** 触发规则ID */
    private String ruleId;

    /** 告警标题 */
    private String alertTitle;

    /** 监测指标 */
    private String metric;

    /** 触发值 */
    private BigDecimal metricValue;

    /** 告警级别 INFO/WARN/CRITICAL */
    private String alertLevel;

    /** 告警时间 */
    private LocalDateTime alertTime;

    /** 处置人 */
    private String handleBy;

    /** 处置时间 */
    private LocalDateTime handleTime;

    /** 处置说明 */
    private String handleRemark;

    /** 状态 PENDING/HANDLED/IGNORED */
    private String status;
}
