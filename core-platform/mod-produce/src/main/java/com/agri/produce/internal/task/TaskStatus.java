package com.agri.produce.internal.task;

import java.util.List;

/**
 * 农事任务状态词表（PRD 8.1.1）——新旧两套词表并存期的<b>唯一收敛点</b>。
 *
 * <p><b>为什么要有这个类。</b>任务状态此前散落在 {@code TaskInfoService}、
 * {@code AdminDashboardService}、{@code AdminMonitorService} 三处以字面量硬编码。
 * PRD 8.1.1 的目标词表是
 * {@code pending / executing / completed / suspended / cancelled / expired / rejected}，
 * 库内现存的是 {@code pending / assigned / doing / done / rejected}。
 * 映射为 {@code doing→executing}、{@code done→completed}，
 * {@code pending / assigned / rejected} 不变（{@code assigned} 是真业务态，
 * {@code TaskInfoService#assign} 写它，砍掉等于丢状态）。
 *
 * <p><b>并存期的两条纪律</b>（数据迁移 V18 尚未执行，执行后库内才会变成新值）：
 * <ol>
 *   <li><b>查询一律取「两套写法」走 {@code IN (...)}</b>，不要用单值 EQ。
 *       单值 EQ 在迁移后会命中 0 行且不报错——静默归零。</li>
 *   <li><b>对外 Map 的键保持旧词表不变</b>。前端按状态串做 key
 *       （{@code TaskMonitor} 的筛选项、{@code isTaskDone} 判定），
 *       改键等于改契约，会连带前端一起坏；键不动、计数范围两套都覆盖，前后都对。</li>
 * </ol>
 *
 * <p><b>写入口径暂不切换。</b>{@code assign/start/accept/submit} 目前仍写旧值
 * （{@link #DOING_LEGACY} / {@link #DONE_LEGACY}），与库内现存数据保持一致；
 * 待 V18 数据切换时把这几处换成 {@link #DOING_PRD} / {@link #DONE_PRD} 即可，
 * 届时本类的查询侧已提前兼容，不需要再动。
 */
public final class TaskStatus {

    private TaskStatus() {
    }

    /** 待派发（新旧同串） */
    public static final String PENDING = "pending";
    /** 已派工（新旧同串；真业务态，PRD 词表需补一行） */
    public static final String ASSIGNED = "assigned";
    /** 执行中 —— 旧词表（迁移前库内值） */
    public static final String DOING_LEGACY = "doing";
    /** 执行中 —— PRD 8.1.1（迁移后库内值） */
    public static final String DOING_PRD = "executing";
    /** 已完成 —— 旧词表（迁移前库内值） */
    public static final String DONE_LEGACY = "done";
    /** 已完成 —— PRD 8.1.1（迁移后库内值） */
    public static final String DONE_PRD = "completed";
    /** 已驳回（新旧同串） */
    public static final String REJECTED = "rejected";

    // 以下三个 PRD 8.1.1 有、但库内当前无数据：只在此登记词表，不改数据、不参与查询。
    /** 已暂停（PRD 8.1.1，当前无数据） */
    public static final String SUSPENDED = "suspended";
    /** 已取消（PRD 8.1.1，当前无数据） */
    public static final String CANCELLED = "cancelled";
    /** 已逾期（PRD 8.1.1，当前无数据；前端现为按 planEndDate 本地派生） */
    public static final String EXPIRED = "expired";

    /**
     * 「执行中」的两套写法，供查询走 {@code IN (...)}。
     *
     * @return 旧值与新值，永不为 null
     */
    public static List<String> doingValues() {
        return List.of(DOING_LEGACY, DOING_PRD);
    }

    /**
     * 「已完成」的两套写法，供查询走 {@code IN (...)}。
     *
     * @return 旧值与新值，永不为 null
     */
    public static List<String> doneValues() {
        return List.of(DONE_LEGACY, DONE_PRD);
    }

    /**
     * 未完成（待派发 / 已派工 / 执行中）——Dashboard 的 taskPending 口径。
     *
     * @return 状态列表，永不为 null
     */
    public static List<String> unfinishedValues() {
        return List.of(PENDING, ASSIGNED, DOING_LEGACY, DOING_PRD);
    }

    /**
     * 我的待办（已派工 / 执行中）——{@code TaskInfoService#listByAssignee} 口径。
     *
     * @return 状态列表，永不为 null
     */
    public static List<String> todoValues() {
        return List.of(ASSIGNED, DOING_LEGACY, DOING_PRD);
    }

    /**
     * 状态监控的分组键：一律用<b>旧词表</b>键名。
     *
     * <p>前端 {@code TaskMonitor} 的筛选项与 {@code isTaskDone} 判定都按这些键取值，
     * 键一旦换成新词表，前端不动就会静默归零。因此键保持旧值，
     * 计数范围由 {@link #valuesOf(String)} 覆盖新旧两套。
     *
     * @return 分组键列表（旧词表），永不为 null
     */
    public static List<String> monitorKeys() {
        return List.of(PENDING, ASSIGNED, DOING_LEGACY, DONE_LEGACY, REJECTED);
    }

    /**
     * 已完成判定（新旧两套都认）。
     *
     * @param status 状态串，可为 null
     * @return 已完成返回 true
     */
    public static boolean isDone(String status) {
        return DONE_LEGACY.equals(status) || DONE_PRD.equals(status);
    }

    /**
     * 旧词表键 → 该状态的两套写法，供查询走 {@code IN (...)}。
     *
     * <p>用于「按旧词表键分组、但计数要覆盖新旧两套」的循环。
     * 未登记差异的键（{@code pending / assigned / rejected}）原样返回单元素列表。
     *
     * @param key 旧词表状态键
     * @return 该状态的全部写法，永不为 null
     */
    public static List<String> valuesOf(String key) {
        if (DOING_LEGACY.equals(key)) {
            return doingValues();
        }
        if (DONE_LEGACY.equals(key)) {
            return doneValues();
        }
        return List.of(key);
    }
}
