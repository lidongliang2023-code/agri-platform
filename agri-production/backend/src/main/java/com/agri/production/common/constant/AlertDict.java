package com.agri.production.common.constant;

import java.util.List;
import java.util.Locale;

/**
 * 告警的词表：**库内文案 ↔ 页面数字编码**。
 *
 * <p>为什么必须有这么一层：{@code agri_prod_alert_record.status} 存的是英文串，而且
 * <b>两代词表在库里并存</b>（旧：{@code PENDING/HANDLING/HANDLED/IGNORED}；
 * 新：{@code pending/handling/handled/ignored}，另有 {@code unhandled} 这个同义写法），
 * 演示数据里两种写法都有（实测 handled 6 / HANDLING 2 / IGNORED 1 / PENDING 3）。
 * 而页面 {@code Alert.status} 是 1~4 的数字，用 {@code status === 1} 做筛选与角标判定 ——
 * 直接返回库内串会让筛选永远筛不出东西、处置按钮判错状态，是典型的"页面能渲染但功能是假的"。</p>
 *
 * <p>两条硬约束（改这个类之前先读）：</p>
 * <ol>
 *   <li><b>查询一律用 {@link #statusValuesOf(int)} / {@link #levelValuesOf(int)} 走 IN</b>，
 *       不要用单个值走 EQ —— 两代词表并存时 EQ 必然漏数据；</li>
 *   <li><b>写入只写 {@link #statusTextOf(int)} 给出的规范值</b>（小写），
 *       新数据不再制造第三种写法。</li>
 * </ol>
 *
 * <p><b>级别口径（2026-10-16 定）</b>：按页面自己的阶梯
 * {@code 1 提示 / 2 一般 / 3 严重 / 4 紧急} 对齐
 * {@code info→1 / normal,warn→2 / important,error,critical→3 / urgent→4}。
 * 库内这批 {@code critical} 行来自平台侧演示集，平台自己的口径就是 {@code CRITICAL→严重(3)}，
 * 所以以数据来源为准。此前管理端把 {@code critical} 归到 4（紧急），本次一并改为 3 ——
 * 同一张表在两个页面显示成两种级别比"少一个 紧急"严重得多。</p>
 */
public final class AlertDict {

    /** 状态：未处理 */
    public static final int STATUS_PENDING = 1;
    /** 状态：处理中 */
    public static final int STATUS_HANDLING = 2;
    /** 状态：已处理 */
    public static final int STATUS_HANDLED = 3;
    /** 状态：已忽略 */
    public static final int STATUS_IGNORED = 4;

    /** 级别：提示 */
    public static final int LEVEL_INFO = 1;
    /** 级别：一般 */
    public static final int LEVEL_NORMAL = 2;
    /** 级别：严重 */
    public static final int LEVEL_IMPORTANT = 3;
    /** 级别：紧急 */
    public static final int LEVEL_URGENT = 4;

    private AlertDict() {
    }

    /** 库内状态串 → 数字编码；认不出来时按"未处理"处理（宁可多显示一条待处理，也不要漏掉）。 */
    public static int codeOfStatus(String raw) {
        String text = normalize(raw);
        return switch (text) {
            case "handling", "processing", "in_progress" -> STATUS_HANDLING;
            case "handled", "closed", "resolved", "done" -> STATUS_HANDLED;
            case "ignored" -> STATUS_IGNORED;
            default -> STATUS_PENDING;
        };
    }

    /** 数字编码 → 查询用的状态串列表（含两代词表与同义写法）。 */
    public static List<String> statusValuesOf(int code) {
        return switch (code) {
            case STATUS_HANDLING -> List.of("HANDLING", "handling", "processing");
            case STATUS_HANDLED -> List.of("HANDLED", "handled", "closed");
            case STATUS_IGNORED -> List.of("IGNORED", "ignored");
            default -> List.of("PENDING", "pending", "unhandled");
        };
    }

    /** 数字编码 → 写入用的规范状态串（全小写，新数据只写这套）。 */
    public static String statusTextOf(int code) {
        return switch (code) {
            case STATUS_HANDLING -> "handling";
            case STATUS_HANDLED -> "handled";
            case STATUS_IGNORED -> "ignored";
            default -> "pending";
        };
    }

    /** 库内级别串 → 数字编码；认不出来时按"提示"处理。 */
    public static int codeOfLevel(String raw) {
        String text = normalize(raw);
        return switch (text) {
            case "normal", "warn", "warning", "medium", "一般" -> LEVEL_NORMAL;
            case "important", "error", "critical", "high", "重要", "严重" -> LEVEL_IMPORTANT;
            case "urgent", "fatal", "紧急" -> LEVEL_URGENT;
            default -> LEVEL_INFO;
        };
    }

    /** 数字编码 → 查询用的级别串列表（含两代词表、中文与同义写法）。 */
    public static List<String> levelValuesOf(int code) {
        return switch (code) {
            case LEVEL_NORMAL -> List.of("normal", "NORMAL", "warn", "warning", "medium", "一般");
            case LEVEL_IMPORTANT -> List.of("important", "IMPORTANT", "error", "critical", "CRITICAL", "high", "重要", "严重");
            case LEVEL_URGENT -> List.of("urgent", "URGENT", "fatal", "紧急");
            default -> List.of("info", "INFO", "提示");
        };
    }

    /** 库内来源串 → 数字编码（1 环境 / 2 设备 / 3 病虫害 / 4 任务 / 5 投入品）。 */
    public static int codeOfSource(String raw) {
        String text = normalize(raw);
        return switch (text) {
            case "device", "equipment", "2" -> 2;
            case "pest", "disease", "3" -> 3;
            case "task", "4" -> 4;
            case "input", "5" -> 5;
            default -> 1;
        };
    }

    private static String normalize(String raw) {
        return raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
    }
}
