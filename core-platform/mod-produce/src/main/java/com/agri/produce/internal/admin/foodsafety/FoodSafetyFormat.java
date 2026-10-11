package com.agri.produce.internal.admin.foodsafety;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 运营端食品安全模块的时间展示文案工具。
 *
 * <p>契约里若干时间字段是<strong>文案</strong>而非 ISO 时间（{@code FoodSafetyAlert.time} =
 * {@code 07-14 10:30}、{@code CirculationRecord.foundAt} = {@code HH:mm|昨天}、
 * {@code MatchRecord.time} = {@code MM-DD}）。前端直接把这些串渲染进列表，
 * 因此格式化必须发生在后端，且口径集中在此处，避免各服务各写一套。</p>
 */
public final class FoodSafetyFormat {

    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter MMDD_HHMM = DateTimeFormatter.ofPattern("MM-dd HH:mm");
    private static final DateTimeFormatter MMDD = DateTimeFormatter.ofPattern("MM-dd");
    private static final DateTimeFormatter YMD_HM = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private FoodSafetyFormat() {
    }

    /**
     * 事件时间文案：当天 → {@code HH:mm}；昨天 → {@code 昨天}；更早 → {@code MM-dd HH:mm}。
     *
     * <p>契约只规定了「当天 / 跨天（昨天）」两档，跨天再细分日期是超集，不影响契约兼容。</p>
     *
     * @param time 事件时间，可为 null
     * @return 展示文案；入参为 null 时返回 null（不填占位值）
     */
    public static String eventTime(LocalDateTime time) {
        if (time == null) {
            return null;
        }
        LocalDate day = time.toLocalDate();
        LocalDate today = LocalDate.now();
        if (day.equals(today)) {
            return time.format(HHMM);
        }
        if (day.equals(today.minusDays(1))) {
            return "昨天";
        }
        return time.format(MMDD_HHMM);
    }

    /**
     * 撮合时间文案（{@code MM-DD}）。
     *
     * @param time 撮合时间，可为 null
     * @return 展示文案；入参为 null 时返回 null
     */
    public static String monthDay(LocalDateTime time) {
        return time == null ? null : time.format(MMDD);
    }

    /**
     * 校验时间文案（{@code yyyy-MM-dd HH:mm}）。
     *
     * @param time 校验时间，可为 null
     * @return 展示文案；入参为 null 时返回 null
     */
    public static String dateTime(LocalDateTime time) {
        return time == null ? null : time.format(YMD_HM);
    }
}
