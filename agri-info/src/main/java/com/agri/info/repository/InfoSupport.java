package com.agri.info.repository;

import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 信息资讯模块两个仓储（用户端 / 运营端）共用的取值、格式化与序列号工具。
 *
 * <p>抽出来的原因：参数取值与号段生成在两个仓储里几乎逐行重复，
 * 复制两遍以后任何一处口径调整（例如序列号格式）都会漏改另一处。</p>
 */
public abstract class InfoSupport {

    protected static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    protected static final DateTimeFormatter SERIAL_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final AtomicLong SERIAL = new AtomicLong();

    protected final JdbcTemplate jdbc;

    protected InfoSupport(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 当前登录用户（统一账号昵称）。前端通过 X-Agri-User 透传，缺失时归入平台用户。 */
    public String owner(String headerValue) {
        if (headerValue == null || headerValue.isBlank()) {
            return "平台用户";
        }
        // 浏览器对非 ASCII 的请求头值支持不一致，前端统一做了 URL 编码，这里还原。
        try {
            return java.net.URLDecoder.decode(headerValue.trim(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ignored) {
            return headerValue.trim();
        }
    }

    protected long number(String sql) {
        Number value = jdbc.queryForObject(sql, Number.class);
        return value == null ? 0 : value.longValue();
    }

    protected long number(String sql, Object... args) {
        Number value = jdbc.queryForObject(sql, Number.class, args);
        return value == null ? 0 : value.longValue();
    }

    protected List<String> split(String value) {
        return split(value, ",");
    }

    protected List<String> split(String value, String delimiter) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (String part : value.split(java.util.regex.Pattern.quote(delimiter))) {
            if (!part.isBlank()) {
                values.add(part.trim());
            }
        }
        return values;
    }

    protected String formatTimestamp(ResultSet rs, String column) throws SQLException {
        java.sql.Timestamp value = rs.getTimestamp(column);
        return value == null ? "" : value.toLocalDateTime().format(DATE_TIME);
    }

    protected String required(Map<String, Object> body, String key, String message) {
        String value = text(body, key, "");
        if (value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    protected String text(Map<String, Object> body, String key, String fallback) {
        Object value = body.get(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value).trim();
    }

    protected long longValue(Object value, long fallback) {
        if (value == null || String.valueOf(value).isBlank()) {
            return fallback;
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    protected int intValue(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ignored) {
            return 0;
        }
    }

    protected boolean boolValue(Object value, boolean fallback) {
        if (value == null) {
            return fallback;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return fallback;
        }
        return "true".equalsIgnoreCase(text) || "1".equals(text) || "是".equals(text);
    }

    protected BigDecimal decimal(Object value, BigDecimal fallback) {
        if (value == null || String.valueOf(value).isBlank()) {
            return fallback;
        }
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    protected String nowLabel() {
        return LocalDateTime.now().format(DATE_TIME);
    }

    protected String today() {
        return LocalDate.now().toString();
    }

    protected String serial(String prefix) {
        long sequence = Math.floorMod(SERIAL.incrementAndGet(), 1000);
        return prefix + LocalDateTime.now().format(SERIAL_TIME) + String.format("%03d", sequence);
    }

    protected String like(String keyword) {
        return "%" + keyword.toLowerCase(java.util.Locale.ROOT) + "%";
    }

    /** 把 "7.9,8.2,8.1" 形式的走势串解析为数值列表，用于详情页趋势图。 */
    protected List<BigDecimal> trend(String value) {
        List<BigDecimal> points = new ArrayList<>();
        for (String part : split(value)) {
            try {
                points.add(new BigDecimal(part));
            } catch (NumberFormatException ignored) {
                // 脏数据直接跳过，不让单个点位打断整条曲线
            }
        }
        return points;
    }
}
