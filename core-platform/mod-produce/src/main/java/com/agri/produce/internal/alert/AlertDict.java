package com.agri.produce.internal.alert;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 告警字典：数据库存英文枚举，对外（前端）统一数字编码。
 *
 * <p><b>为什么要分两套口径。</b>{@code prod_alert_info.status} 在库内必须保持
 * {@code PENDING/HANDLING/HANDLED/IGNORED} 大写英文——{@code AdminAlertService}、
 * {@code AdminMonitorService}、{@code TenantOverviewService} 以及
 * {@code IotDeviceService} 的故障态判定原生 SQL 都按 {@code status='PENDING'} 查询，
 * 改成数字会静默击穿这些链路。而前端 {@code src/types/alert.ts} 全量使用
 * {@code 1/2/3/4} 数字枚举。因此收敛点放在本类：Controller 出入参一律数字，
 * Service 落库前转英文。
 *
 * <p><b>告警级别目前新旧两套词表并存。</b>PRD 8.1.2 的目标词表是
 * {@code info / normal / important / urgent}，库内现存的是
 * {@code INFO / WARN / CRITICAL / URGENT}。零漂移映射：
 * {@code INFO→info(1)}、{@code WARN→normal(2)}、{@code CRITICAL→important(3)}、
 * {@code URGENT→urgent(4)}——<b>数字编码与配色全不变，所以前端零改动</b>。
 *
 * <p><b>并存期的正确用法（重要）</b>：数据迁移（<b>V18</b>）尚未执行，库内仍是旧值；
 * 迁移之后库内变成新值。为了让迁前迁后都不出错：
 * <ul>
 *   <li><b>查询</b>一律用 {@link #levelValuesOf(Integer)} / {@link #levelValuesOfName(String)}
 *       取「两套写法」走 {@code IN (...)}，<b>不要用 {@link #levelOf(Integer)} 走 EQ</b>——
 *       单值 EQ 在迁移后会命中 0 行，且不报错，正是本项目反复在治的静默归零。</li>
 *   <li><b>识别</b>（库内串 → 数字）用 {@link #codeOfLevel(String)}，两套都认。</li>
 * </ul>
 *
 * <p><b>未识别值一律返回 null，不猜、不补默认值，但必须留日志。</b>无法映射的编码宁可让前端显示
 * 「—」，也不能编造成「未处理」造成告警漏处置；同时 {@code default} 分支要打 warn 并带上原值，
 * 否则词表一旦漏配就没有任何痕迹可查。
 */
@Slf4j
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

    // ---------------------------------------------------------------- 告警级别词表
    // 旧词表（库内现存）与 PRD 8.1.2 目标词表（迁移后）。两套并存期间本类统一收敛，
    // 其它任何地方都不许再硬编码这些字面量。

    /** 级别：提示（旧词表，迁移前库内值） */
    public static final String LEVEL_INFO_LEGACY = "INFO";
    /** 级别：一般（旧词表，迁移前库内值） */
    public static final String LEVEL_WARN_LEGACY = "WARN";
    /** 级别：严重（旧词表，迁移前库内值） */
    public static final String LEVEL_CRITICAL_LEGACY = "CRITICAL";
    /** 级别：紧急（旧词表，迁移前库内值） */
    public static final String LEVEL_URGENT_LEGACY = "URGENT";

    /** 级别：提示（PRD 8.1.2，迁移后库内值） */
    public static final String LEVEL_INFO_PRD = "info";
    /** 级别：一般（PRD 8.1.2，迁移后库内值）；对应旧词表 WARN */
    public static final String LEVEL_NORMAL_PRD = "normal";
    /** 级别：严重（PRD 8.1.2，迁移后库内值）；对应旧词表 CRITICAL */
    public static final String LEVEL_IMPORTANT_PRD = "important";
    /** 级别：紧急（PRD 8.1.2，迁移后库内值） */
    public static final String LEVEL_URGENT_PRD = "urgent";

    /**
     * 归一化比较用的小写旧值。{@code INFO / URGENT} 与 PRD 的 {@code info / urgent}
     * 仅是大小写差异，归一化后同串；{@code WARN / CRITICAL} 与 {@code normal / important}
     * 是完全不同的词，必须各占一个分支。
     */
    private static final String LEGACY_WARN_NORM = "warn";
    private static final String LEGACY_CRITICAL_NORM = "critical";

    /** 数字编码 → 该级别的两套写法（旧在前、新在后），供查询走 IN (...) */
    private static final Map<Integer, List<String>> LEVEL_VALUES = Map.of(
            1, List.of(LEVEL_INFO_LEGACY, LEVEL_INFO_PRD),
            2, List.of(LEVEL_WARN_LEGACY, LEVEL_NORMAL_PRD),
            3, List.of(LEVEL_CRITICAL_LEGACY, LEVEL_IMPORTANT_PRD),
            4, List.of(LEVEL_URGENT_LEGACY, LEVEL_URGENT_PRD));

    /** 数字编码 → PRD 8.1.2 词表的<b>唯一</b>写法，供写入 / 入站归一化使用 */
    private static final Map<Integer, String> PRD_BY_CODE = Map.of(
            1, LEVEL_INFO_PRD,
            2, LEVEL_NORMAL_PRD,
            3, LEVEL_IMPORTANT_PRD,
            4, LEVEL_URGENT_PRD);

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
     * 告警级别数字编码 → 库内英文枚举（<b>旧词表口径</b>）。
     *
     * <p>⚠️ 本方法返回的是<b>单值</b>，只能用于「写入/拼装」场景。
     * <b>查询一律改用 {@link #levelValuesOf(Integer)} 走 IN (...)</b>：
     * 数据迁移（V18）之后库内变成 {@code info/important/...}，
     * 用单值做 EQ 在迁移前/后总有一半命中不到，且不报错（静默归零）。
     *
     * <p><b>为什么返回 PRD 词表而不是旧词表。</b>写入必须朝目标词表收敛：
     * 若继续写旧值，V18 迁完之后新数据又把旧值灌回来，表会长期新旧混杂，
     * 每一次"迁移已完成"的结论都不可靠。读侧已经全部走 {@code IN} 两套写法，
     * 因此写入新值<b>不会</b>影响迁前迁后的任何计数。
     *
     * @param code 1提示 2一般 3严重 4紧急
     * @return PRD 8.1.2 词表枚举（写入用）；code 为空返回 null
     */
    public static String levelOf(Integer code) {
        if (code == null) {
            return null;
        }
        String value = PRD_BY_CODE.get(code);
        if (value == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "告警级别取值非法：" + code + "（应为 1提示 2一般 3严重 4紧急）");
        }
        return value;
    }

    /**
     * 入站级别串 → 库内统一写法（<b>新旧都认，统一归一到 PRD 词表</b>）。
     *
     * <p>用于外部事件入口（satellite-iot 经 {@code iot.alert.raised} 灌进来的
     * {@code level}）：上游写的是旧词表 {@code CRITICAL/WARN}，若原样落库，
     * V18 迁完之后新数据继续把旧值灌进已迁移的表，"迁移完成"再次失效。
     * 因此入站一律归一到 PRD 词表再落库。
     *
     * <p>已经无法识别的值<b>原样返回</b>并打 warn，不做静默替换：
     * 宁可让库里留一个能被 {@code codeOfLevel} 认不出的值（前端显示「—」），
     * 也不能把未知级别悄悄改成某一档——那会让告警严重度失真，比显示「—」危险得多。
     *
     * @param level 入站级别串，旧（{@code CRITICAL}）新（{@code important}）都收
     * @return 归一到 PRD 词表的写法；入参为 null/空白返回原值；无法识别时原样返回
     */
    public static String normalizeLevel(String level) {
        if (level == null || level.isBlank()) {
            return level;
        }
        Integer code = codeOfLevel(level);
        if (code == null) {
            log.warn("入站告警级别无法归类，原样落库（前端将显示「—」）：level={}", level);
            return level;
        }
        return PRD_BY_CODE.get(code);
    }

    /**
     * 告警级别数字编码 → 该级别的<b>全部写法</b>（旧 + 新），供查询走 {@code IN (...)}。
     *
     * <p>并存期必须用这个方法：迁前只有旧值、迁后只有新值，
     * {@code IN} 两种都列，前后都能命中，不需要等迁移完成再改代码。
     *
     * @param code 1提示 2一般 3严重 4紧急；为空返回空列表（配合 Wrapper 的 condition 重载使用）
     * @return 两套写法，永不为 null
     */
    public static List<String> levelValuesOf(Integer code) {
        if (code == null) {
            return List.of();
        }
        List<String> values = LEVEL_VALUES.get(code);
        if (values == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "告警级别取值非法：" + code + "（应为 1提示 2一般 3严重 4紧急）");
        }
        return values;
    }

    /**
     * 级别名（旧词表或新词表均可）→ 该级别的<b>全部写法</b>，供查询走 {@code IN (...)}。
     *
     * <p>用于「Map 的键是级别串、值按该级别计数」这类场景
     * （如 {@code AdminAlertService#stats} / {@code AdminDashboardService#alertTrend}）：
     * 键保持旧词表不变（前端按键取值，改键等于改契约），
     * 但计数范围同时覆盖新旧两套写法，迁前迁后数字都对。
     *
     * @param level 级别串，旧（{@code INFO}）新（{@code info}）都收；无法识别返回空列表
     * @return 两套写法，无法识别时为空列表，永不为 null
     */
    public static List<String> levelValuesOfName(String level) {
        Integer code = codeOfLevel(level);
        return code == null ? List.of() : LEVEL_VALUES.get(code);
    }

    /**
     * 库内英文枚举 → 告警级别数字编码（<b>新旧词表都认</b>）。
     *
     * <p>归一化口径：先 {@code trim()} 再转小写。{@code INFO/URGENT} 与 PRD 的
     * {@code info/urgent} 归一化后是同一个串，共用分支；
     * {@code WARN→normal}、{@code CRITICAL→important} 是完全不同的词，各占分支。
     *
     * @param level 库内级别串（旧词表或新词表，兼容大小写与空白）
     * @return 数字编码；无法识别返回 null（并打 warn 日志带原值），由前端显示「—」
     */
    public static Integer codeOfLevel(String level) {
        if (level == null || level.isBlank()) {
            return null;
        }
        return switch (level.trim().toLowerCase(Locale.ROOT)) {
            case LEVEL_INFO_PRD -> 1;
            // 旧 WARN / 新 normal：两个词完全不同，必须都列
            case LEGACY_WARN_NORM, LEVEL_NORMAL_PRD -> 2;
            // 旧 CRITICAL / 新 important：同上
            case LEGACY_CRITICAL_NORM, LEVEL_IMPORTANT_PRD -> 3;
            case LEVEL_URGENT_PRD -> 4;
            default -> {
                log.warn("告警级别词表未识别，返回 null 由前端显示「—」：level={}", level);
                yield null;
            }
        };
    }
}
