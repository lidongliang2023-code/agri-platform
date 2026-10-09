package com.agri.produce.internal.alert;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import java.util.Locale;

/**
 * 告警字典：数据库存大写英文枚举，对外（前端）统一数字编码。
 *
 * <p><b>为什么要分两套口径。</b>{@code prod_alert_info.status} 在库内必须保持
 * {@code PENDING/HANDLING/HANDLED/IGNORED} 大写英文——{@code AdminAlertService}、
 * {@code AdminMonitorService}、{@code TenantOverviewService} 以及
 * {@code IotDeviceService} 的故障态判定原生 SQL 都按 {@code status='PENDING'} 查询，
 * 改成数字会静默击穿这些链路。而前端 {@code src/types/alert.ts} 全量使用
 * {@code 1/2/3/4} 数字枚举。因此收敛点放在本类：Controller 出入参一律数字，
 * Service 落库前转英文。
 *
 * <p><b>未识别值一律返回 null，不猜、不补默认值。</b>无法映射的编码宁可让前端显示
 * 「—」，也不能编造成「未处理」造成告警漏处置。
 */
public final class AlertDict {

    private AlertDict() {
    }

    /** 状态：未处理 */
    public static final String STATUS_PENDING = "PENDING";
    /** 状态：处理中 */
    public static final String STATUS_HANDLING = "HANDLING";
    /** 状态：已处理 */
    public static final String STATUS_HANDLED = "HANDLED";
    /** 状态：已忽略 */
    public static final String STATUS_IGNORED = "IGNORED";

    /**
     * 状态数字编码 → 库内英文枚举。
     *
     * @param code 1未处理 2处理中 3已处理 4已忽略
     * @return 库内枚举；code 为空返回 null
     */
    public static String statusOf(Integer code) {
        if (code == null) {
            return null;
        }
        return switch (code) {
            case 1 -> STATUS_PENDING;
            case 2 -> STATUS_HANDLING;
            case 3 -> STATUS_HANDLED;
            case 4 -> STATUS_IGNORED;
            default -> throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "告警状态取值非法：" + code + "（应为 1未处理 2处理中 3已处理 4已忽略）");
        };
    }

    /**
     * 库内英文枚举 → 状态数字编码。
     *
     * @param status 库内状态串（兼容大小写与空白）
     * @return 数字编码；无法识别返回 null，由前端显示「—」
     */
    public static Integer codeOfStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        return switch (status.trim().toUpperCase(Locale.ROOT)) {
            case STATUS_PENDING -> 1;
            case STATUS_HANDLING -> 2;
            case STATUS_HANDLED -> 3;
            case STATUS_IGNORED -> 4;
            default -> null;
        };
    }

    /**
     * 告警级别数字编码 → 库内英文枚举。
     *
     * @param code 1提示 2一般 3严重 4紧急
     * @return 库内枚举 INFO/WARN/CRITICAL/URGENT
     */
    public static String levelOf(Integer code) {
        if (code == null) {
            return null;
        }
        return switch (code) {
            case 1 -> "INFO";
            case 2 -> "WARN";
            case 3 -> "CRITICAL";
            case 4 -> "URGENT";
            default -> throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "告警级别取值非法：" + code + "（应为 1提示 2一般 3严重 4紧急）");
        };
    }

    /**
     * 库内英文枚举 → 告警级别数字编码。
     *
     * @param level 库内级别串
     * @return 数字编码；无法识别返回 null
     */
    public static Integer codeOfLevel(String level) {
        if (level == null || level.isBlank()) {
            return null;
        }
        return switch (level.trim().toUpperCase(Locale.ROOT)) {
            case "INFO" -> 1;
            case "WARN" -> 2;
            case "CRITICAL" -> 3;
            case "URGENT" -> 4;
            default -> null;
        };
    }
}
