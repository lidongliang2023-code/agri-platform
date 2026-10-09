package com.agri.core.infra.web;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * 宽松的 {@code LocalDateTime} 反序列化器。
 *
 * <p>背景：全局序列化统一为 {@code yyyy-MM-dd HH:mm:ss}，此前反序列化也只认这一种格式，
 * 导致前端（dayjs / {@code toISOString()}，形如 {@code 2026-10-01T08:00:00}）提交的时间字段
 * 一律被拒，返回 400「请求体格式错误」——接口能调通但永远写不进时间。</p>
 *
 * <p>此处按「先严格后宽松」依次尝试多种常见格式，序列化格式保持 {@code yyyy-MM-dd HH:mm:ss} 不变
 * （不影响既有前端解析），仅放宽入参。</p>
 *
 * <p>继承 {@link LocalDateTimeDeserializer} 而非直接实现 {@code JsonDeserializer}：
 * {@code Jackson2ObjectMapperBuilder#deserializers} 需要能推断出处理的类型，
 * 裸实现会抛 {@code Unknown handled type} 导致上下文起不来。</p>
 */
public class LenientLocalDateTimeDeserializer extends LocalDateTimeDeserializer {

    /** 与主序列化口径一致，放在首位优先命中 */
    private static final List<DateTimeFormatter> FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ISO_LOCAL_DATE_TIME,
            DateTimeFormatter.ISO_DATE_TIME,
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm:ss"));

    @Override
    public LocalDateTime deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        String raw = parser.getValueAsString();
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String text = raw.trim();
        for (DateTimeFormatter formatter : FORMATTERS) {
            try {
                return LocalDateTime.parse(text, formatter);
            } catch (DateTimeParseException ignored) {
                // 继续尝试下一种格式
            }
        }
        // 纯日期（yyyy-MM-dd）按当天零点处理，便于只传日期的场景
        try {
            return LocalDate.parse(text, DateTimeFormatter.ISO_LOCAL_DATE).atStartOfDay();
        } catch (DateTimeParseException ignored) {
            throw InvalidFormatException.from(parser,
                    "无法解析为 LocalDateTime，支持格式：yyyy-MM-dd HH:mm:ss / yyyy-MM-dd'T'HH:mm:ss / yyyy-MM-dd",
                    text, LocalDateTime.class);
        }
    }
}
