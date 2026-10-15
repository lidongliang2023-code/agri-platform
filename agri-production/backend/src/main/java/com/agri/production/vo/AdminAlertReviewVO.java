package com.agri.production.vo;

import com.agri.production.entity.AlertRecord;
import lombok.Data;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 运营端「灾害事件复盘」行（页面 {@code AlertReviewItem}，见 pages/admin/alerts/DisasterReview.tsx）。
 *
 * <p><b>为什么这不是"复盘"而是"告警"</b>：该页的列表数据源就是 {@code GET /admin/alerts/review}，
 * 而它**只认带 {@code alertId} 的行**（没有 alertId 的行会被整行过滤掉），
 * 页面里的字段映射也写着"事件名称←alertTitle、处置说明←handleRemark"。
 * 也就是说这一页是"拿已处置告警当复盘视图用"，后端从来没有独立的复盘模型
 * （api 层那个 {@code DisasterReview} 类型是乐观猜测，页面自己在注释里否掉了）。</p>
 *
 * <p>三项**转数字**：{@code alertLevel 1-4}、{@code alertSource 1-5}、{@code status 1-4} ——
 * 页面用它们查 LEVEL_MAP / STATUS_MAP 取文案与颜色，文本值会让映射取到 undefined 再访问 .color 崩页
 * （core-platform 的注释里记着同一次事故）。转不出来的给 null，不瞎猜一个级别。</p>
 */
@Data
public class AdminAlertReviewVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String alertId;
    /** 告警编号（库里 alert_code，如 DEMO-ALERT-001） */
    private String alertNo;
    private String alertTitle;
    /** 告警内容（库里 content） */
    private String alertContent;
    /** 1 提示 / 2 一般 / 3 重要 / 4 紧急 */
    private Integer alertLevel;
    /** 1 环境 / 2 设备 / 3 病虫害 / 4 任务 / 5 投入品 */
    private Integer alertSource;
    private String farmId;
    private String plotId;
    /** 地块名称（由地块表补；补不到为 null，页面显示「—」） */
    private String plotName;
    private String deviceId;
    private java.math.BigDecimal triggerValue;
    /** 1 未处理 / 2 处理中 / 3 已处理 / 4 已忽略 */
    private Integer status;
    private String handlerName;
    private String handleRemark;
    private String triggeredAt;
    private String handledAt;

    public static AdminAlertReviewVO of(AlertRecord entity) {
        return of(entity, null);
    }

    public static AdminAlertReviewVO of(AlertRecord entity, String plotName) {
        if (entity == null) {
            return null;
        }
        AdminAlertReviewVO vo = new AdminAlertReviewVO();
        vo.alertId = entity.getId() == null ? null : String.valueOf(entity.getId());
        vo.alertNo = entity.getAlertCode();
        vo.alertTitle = entity.getTitle();
        vo.alertContent = entity.getContent();
        vo.alertLevel = toLevel(entity.getLevel());
        vo.alertSource = toSource(entity.getSourceType());
        vo.farmId = entity.getFarmId() == null ? null : String.valueOf(entity.getFarmId());
        vo.plotId = entity.getPlotId() == null ? null : String.valueOf(entity.getPlotId());
        vo.plotName = plotName;
        // 设备引用优先取 source_name：本表的 source_id 是 BIGINT，而设备业务编码是 'DEMO-DEV-001'
        // 这类字符串，塞不进数字列 —— 演示数据把编码放在 source_name 里，这里按实际存的取。
        vo.deviceId = "device".equalsIgnoreCase(entity.getSourceType())
                ? (entity.getSourceName() != null ? entity.getSourceName()
                    : (entity.getSourceId() == null ? null : String.valueOf(entity.getSourceId())))
                : null;
        vo.triggerValue = entity.getValue();
        vo.status = toStatus(entity.getStatus());
        vo.handlerName = entity.getHandleUser();
        vo.handleRemark = entity.getHandleResult();
        vo.triggeredAt = format(entity.getCreateTime());
        vo.handledAt = format(entity.getHandleTime());
        return vo;
    }

    private static String format(LocalDateTime value) {
        return value == null ? null : DATE_TIME.format(value);
    }

    /** info/warning/error/critical（含中文与旧词表）→ 1-4；认不出给 null */
    public static Integer toLevel(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String value = text.trim().toLowerCase();
        if (value.matches("[1-4]")) {
            return Integer.valueOf(value);
        }
        return switch (value) {
            case "info", "提示", "低" -> 1;
            case "warning", "warn", "normal", "一般", "中", "medium" -> 2;
            case "error", "high", "重要", "严重", "高" -> 3;
            case "critical", "urgent", "紧急" -> 4;
            default -> null;
        };
    }

    /** environment/device/pest/task/input（含中文）→ 1-5；认不出给 null */
    public static Integer toSource(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String value = text.trim().toLowerCase();
        if (value.matches("[1-5]")) {
            return Integer.valueOf(value);
        }
        return switch (value) {
            case "environment", "env", "soil", "weather", "环境", "气象" -> 1;
            case "device", "iot", "设备" -> 2;
            case "pest", "disease", "病虫害" -> 3;
            case "task", "任务" -> 4;
            case "input", "投入品" -> 5;
            default -> null;
        };
    }

    /** unhandled/pending→1、handling/processing→2、handled→3、ignored→4；认不出给 null */
    public static Integer toStatus(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String value = text.trim().toLowerCase();
        if (value.matches("[1-4]")) {
            return Integer.valueOf(value);
        }
        return switch (value) {
            case "unhandled", "pending", "未处理", "待处理" -> 1;
            case "handling", "processing", "处理中" -> 2;
            case "handled", "closed", "已处理", "已关闭" -> 3;
            case "ignored", "已忽略" -> 4;
            default -> null;
        };
    }
}
