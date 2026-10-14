package com.agri.production.common.constant;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * 种养计划状态：**词表值 ↔ 前端契约码值** 的唯一转换处。
 *
 * <p>两侧取值不一样，而且都不是随便挑的：</p>
 * <ul>
 *   <li>库里存词表值（{@code agri_prod_planting_plan.plan_status}）：
 *       draft / pending / active / completed / terminated；</li>
 *   <li>前端契约要数字（{@code @agri/shared/types/plan} 的 {@code Plan.status}，
 *       语义见 {@code utils/production-adapter} 的 {@code planStatusMeta}）：
 *       1 编制中 / 2 进行中 / 3 已完结 / 4 已取消 / 5 待审批。</li>
 * </ul>
 *
 * <p><b>2 是"进行中"而不是"待审批"</b>：planStatusMeta 与页面动作是同一个口径 ——
 * PlanList 只在 {@code status === 1} 时给"启动"按钮、{@code status === 2} 时给"终止"，
 * 而启动动作写的正是"进行中"。若把 active 映射成 3，"进行中的计划"在页面上会显示成"已完结"，
 * 且"终止"按钮永远不出现；把 pending 映射成 2 则会让待审批的计划显示成"进行中"。</p>
 *
 * <p>一个码值可能对应多个历史词（如 doing / cancelled），过滤时用 IN 而不是等值 ——
 * 否则会出现"筛选条件看着对、数据一条都不出来"。</p>
 */
public final class PlanStatusDict {

    /** 编制中 */
    public static final String DRAFT = "draft";
    /** 待审批 */
    public static final String PENDING = "pending";
    /** 进行中（在种） */
    public static final String ACTIVE = "active";
    /** 已完结 */
    public static final String COMPLETED = "completed";
    /** 已取消（终止） */
    public static final String TERMINATED = "terminated";

    private PlanStatusDict() {
    }

    /**
     * 词表值 → 前端契约码值。
     *
     * @param word 库里的 plan_status
     * @return 1..5；空值与未知值一律按 1（编制中）
     */
    public static Integer toCode(String word) {
        if (word == null || word.isBlank()) {
            return 1;
        }
        switch (word.trim().toLowerCase()) {
            case PENDING:
                return 5;
            case ACTIVE:
            case "doing":
                return 2;
            case COMPLETED:
                return 3;
            case TERMINATED:
            case "cancelled":
                return 4;
            case DRAFT:
            default:
                return 1;
        }
    }

    /**
     * 前端契约码值 → 落库要写的词表值。
     *
     * @param code 1..5
     * @return 词表值；code 为 null 表示"本次不改状态"
     */
    public static String toWord(Integer code) {
        if (code == null) {
            return null;
        }
        switch (code) {
            case 2:
                return ACTIVE;
            case 3:
                return COMPLETED;
            case 4:
                return TERMINATED;
            case 5:
                return PENDING;
            case 1:
            default:
                return DRAFT;
        }
    }

    /**
     * 码值对应的全部词表取值，供 IN 过滤使用。
     *
     * @param code 1..5
     * @return 词表值列表；code 为 null 时返回空列表（调用方据此跳过该条件）
     */
    public static List<String> wordsOf(Integer code) {
        if (code == null) {
            return Collections.emptyList();
        }
        switch (code) {
            case 2:
                return Arrays.asList(ACTIVE, "doing");
            case 4:
                return Arrays.asList(TERMINATED, "cancelled");
            default:
                return Collections.singletonList(toWord(code));
        }
    }

    /**
     * 归一化一个词表值（去空白 + 小写）。
     *
     * @param word 原始取值
     * @return 词表内的合法取值；不认识的一律返回 null（**不猜测**，由调用方决定是拒绝还是忽略）
     */
    public static String normalize(String word) {
        if (word == null || word.isBlank()) {
            return null;
        }
        String value = word.trim().toLowerCase();
        switch (value) {
            case DRAFT:
            case PENDING:
            case ACTIVE:
            case COMPLETED:
            case TERMINATED:
            case "doing":
            case "cancelled":
                return value;
            default:
                return null;
        }
    }
}
