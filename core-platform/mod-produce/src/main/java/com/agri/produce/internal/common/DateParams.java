package com.agri.produce.internal.common;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/**
 * 日期型查询参数解析工具（yyyy-MM-dd）。
 *
 * <p>解析失败一律返回 {@code null} 表示「不过滤」，不抛异常——避免脏参数把整个列表接口打挂。</p>
 */
public final class DateParams {

    private DateParams() {
    }

    /**
     * 解析日期参数。
     *
     * @param value 形如 {@code yyyy-MM-dd} 的字符串，可为 null 或空白
     * @return 解析结果；入参为空或格式非法时返回 null
     */
    public static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }
}
