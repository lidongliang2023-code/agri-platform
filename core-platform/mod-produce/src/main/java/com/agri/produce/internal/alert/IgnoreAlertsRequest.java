package com.agri.produce.internal.alert;

import java.util.List;
import lombok.Data;

/**
 * 批量忽略告警请求体，对应前端 {@code PATCH /alerts/ignore}。
 */
@Data
public class IgnoreAlertsRequest {

    /** 待忽略的告警主键列表 */
    private List<String> alertIds;
}
