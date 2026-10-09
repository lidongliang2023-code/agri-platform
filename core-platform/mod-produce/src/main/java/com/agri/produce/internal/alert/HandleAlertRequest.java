package com.agri.produce.internal.alert;

import lombok.Data;

/**
 * 告警处置请求体，对应前端 {@code PATCH /alerts/{alertId}/handle}。
 *
 * <p>字段命名必须与前端 {@code src/api/alerts.ts handleAlert} 的 payload 完全一致：
 * {@code status}（数字枚举）与 {@code handleRemark}。此前后端用的是
 * {@code @RequestParam remark}，前端发的是 body，参数永远取不到值。
 */
@Data
public class HandleAlertRequest {

    /** 目标状态 2处理中 3已处理 4已忽略 */
    private Integer status;

    /** 处置说明 */
    private String handleRemark;

    /** 处置人姓名（可选，落库到 handle_by） */
    private String handlerName;
}
