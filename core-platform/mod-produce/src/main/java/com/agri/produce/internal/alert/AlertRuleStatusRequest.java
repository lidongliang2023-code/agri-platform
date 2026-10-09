package com.agri.produce.internal.alert;

import lombok.Data;

/**
 * 告警规则启停请求体，对应前端 {@code PATCH /alerts/rules/{ruleId}/status}。
 *
 * <p>字段名 {@code status} 必须与 {@code src/api/alerts.ts updateAlertRuleStatus}
 * 的 payload 一致。
 */
@Data
public class AlertRuleStatusRequest {

    /** 目标状态：1 启用，其余为停用 */
    private Integer status;
}
