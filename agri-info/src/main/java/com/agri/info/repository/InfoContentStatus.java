package com.agri.info.repository;

import java.util.Map;
import java.util.Set;

/**
 * 资讯内容状态的<b>唯一</b>口径：词表、中文文案、允许的流转，以及"编辑能不能改状态"。
 *
 * <p>为什么单独立一个类：此前状态字符串散在 {@code InfoOpsRepository} 的 save/audit/offline
 * 三处与运营端页签里，三处各写各的，结果是三个真实缺陷 ——</p>
 * <ol>
 *   <li>新建内容时 {@code status} 直接取请求体，<b>传 published 就跳过审核直接上线</b>；</li>
 *   <li>审核 {@code UPDATE ... WHERE id=?} 不看当前状态，<b>已下架/已驳回的稿子能被重新 approve 上线</b>，
 *       已发布的稿子还能再审一次把 {@code published_at} 刷成现在；</li>
 *   <li>「退回修改」写入 {@code draft}，但页签与计数都没有 draft，<b>点一次这条稿子就从四个页签全部消失</b>
 *       —— 数据还在库里，只是没人看得见。</li>
 * </ol>
 *
 * <p>内容与行情/政策不一样，它是"已经对外说过的话"：能不能上线必须由服务端判定，
 * 不能由请求体决定，也不能靠前端页签刚好没露出来。</p>
 */
public final class InfoContentStatus {

    public static final String DRAFT = "draft";
    public static final String PENDING = "pending";
    public static final String PUBLISHED = "published";
    public static final String REJECTED = "rejected";
    public static final String OFFLINE = "offline";

    private static final Map<String, String> LABELS = Map.of(
            DRAFT, "草稿",
            PENDING, "待审核",
            PUBLISHED, "已发布",
            REJECTED, "未通过",
            OFFLINE, "已下架");

    /**
     * 允许的流转。注意几条刻意的规定：
     * <ul>
     *   <li><b>没有"直接到 published"的边</b>：只有待审核的稿子能被审核通过 —— 新建与编辑都到不了这里；</li>
     *   <li>已下架要重新上线必须<b>再走一次审核</b>（{@code offline → pending}），
     *       不能由同一个人悄悄放回去；</li>
     *   <li>{@code draft} 是"退回修改"的落点，也是新建的可选落点，必须能被重新提交。</li>
     * </ul>
     */
    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
            DRAFT, Set.of(PENDING),
            PENDING, Set.of(PUBLISHED, REJECTED, DRAFT),
            PUBLISHED, Set.of(OFFLINE),
            REJECTED, Set.of(DRAFT, PENDING),
            OFFLINE, Set.of(PENDING));

    private InfoContentStatus() {
    }

    public static boolean known(String status) {
        return status != null && LABELS.containsKey(status);
    }

    public static String label(String status) {
        return status == null ? "" : LABELS.getOrDefault(status, status);
    }

    /** 全部状态（页面页签与计数按它渲染，不再在前端抄一份列表）。 */
    public static Set<String> all() {
        return LABELS.keySet();
    }

    public static boolean canTransition(String from, String to) {
        if (!known(from) || !known(to)) {
            return false;
        }
        return TRANSITIONS.get(from).contains(to);
    }

    /**
     * 新建内容允许的状态：只有草稿与待审核。
     * 其它值一律拒 —— "传个 published 就直接上线"是这条链上最省事的绕过方式。
     */
    public static boolean creatable(String status) {
        return DRAFT.equals(status) || PENDING.equals(status);
    }

    /** 拒绝原因要说得出口，只回"操作失败"的话运营员只会再点一次。 */
    public static String rejectReason(String from, String to) {
        if (!known(from)) {
            return "内容当前状态无法识别（" + from + "），不能执行该操作";
        }
        if (from.equals(to)) {
            return "内容已经是「" + label(from) + "」，无需重复操作";
        }
        return "内容「" + label(from) + "」不能变成「" + label(to) + "」"
                + (PUBLISHED.equals(to) ? "：只有待审核的内容可以通过审核上线" : "");
    }
}
