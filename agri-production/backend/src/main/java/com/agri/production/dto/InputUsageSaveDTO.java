package com.agri.production.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 投入品使用记录入参（前端 {@code Partial<InputUsageRecord>}）。
 *
 * <p>两个地方刻意放宽：</p>
 * <ul>
 *   <li>关联 ID 全是 String —— 表单里的任务 / 地块下拉可能给出非数字标识；</li>
 *   <li>{@code usedAt} 是 String —— 表单提交的是 dayjs，可能是 ISO（带 T）也可能被别处
 *       格式化成 {@code yyyy-MM-dd HH:mm:ss}，两种都要收（用 LocalDateTime 接会把带空格的那种直接拒掉）。</li>
 * </ul>
 */
@Data
public class InputUsageSaveDTO {

    private String taskId;
    private String plotId;
    private String farmId;

    private String inputId;
    private String inputName;

    /** 用量（契约字段名就是 dosage） */
    private BigDecimal dosage;

    private String unit;

    /** 施用方式 */
    private String method;

    private String operatorId;

    /** 使用时间（yyyy-MM-dd HH:mm:ss 或 ISO） */
    private String usedAt;

    private Integer safetyIntervalDays;

    /** 1 正常 / 0 作废 */
    private Integer status;

    private String remark;
}
