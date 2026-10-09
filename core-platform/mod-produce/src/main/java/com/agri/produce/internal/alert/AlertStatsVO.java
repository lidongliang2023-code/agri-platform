package com.agri.produce.internal.alert;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 告警统计视图，字段与前端 {@code src/api/alerts.ts} 的 {@code AlertStats} 一一对应。
 *
 * <p>此前 {@code /alerts/stats} 返回的是 {@code {INFO:n, WARN:n, CRITICAL:n, pending:n}}，
 * 与前端字段名、形状都对不上，前端只能零值兜底，指标卡恒为 0。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AlertStatsVO {

    /** 告警总数 */
    private long total;

    /** 未处理数（PENDING） */
    private long unhandled;

    /** 处理中数（HANDLING） */
    private long handling;

    /** 已处理数（HANDLED） */
    private long resolved;

    /** 已忽略数（IGNORED） */
    private long ignored;

    /** 各级别数量 */
    private java.util.List<LevelCount> levelCounts;

    /**
     * 单个级别的计数。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LevelCount {

        /** 告警级别：1 提示 2 一般 3 严重 4 紧急 */
        private int level;

        /** 数量 */
        private long count;
    }
}
