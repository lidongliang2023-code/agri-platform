package com.agri.produce.internal.alert;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/**
 * IoT 预警记录（消费自卫星服务 iot.alert.raised 事件）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_iot_alert")
public class IotAlertEntity extends BaseEntity {

    private String deviceNo;
    private String metric;
    private BigDecimal value;
    private BigDecimal threshold;
    /** INFO / WARN / CRITICAL */
    private String level;
    private String message;
}
