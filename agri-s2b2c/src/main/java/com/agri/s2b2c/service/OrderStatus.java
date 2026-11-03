package com.agri.s2b2c.service;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 商城订单状态的<b>唯一</b>口径：词表、中文文案、允许的流转、以及"算不算已支付 / 已完成"。
 *
 * <p>为什么要单独立一个类：此前状态字面量散落在 {@code OrderServiceImpl} 的文案表、
 * {@code ChannelGradeService} 的"已支付"列表、{@code ExperienceController} 的"可申请售后"列表里，
 * 三份各写各的 —— 加一个状态要改三处，漏一处的表现是"这单在 A 页算已完成、在 B 页算不可结算"。
 * 资金相关的判定（结算、等级考核、售后）必须问同一处。</p>
 */
public final class OrderStatus {

    public static final String PENDING_PAY = "PENDING_PAY";
    public static final String PENDING_SHIP = "PENDING_SHIP";
    public static final String SHIPPED = "SHIPPED";
    public static final String PENDING_RECEIVE = "PENDING_RECEIVE";
    public static final String COMPLETED = "COMPLETED";
    public static final String CANCELLED = "CANCELLED";
    public static final String REFUNDING = "REFUNDING";
    public static final String REFUNDED = "REFUNDED";

    /** 词表 → 页面文案（订单列表/详情读它，不在前端再翻译一遍） */
    private static final Map<String, String> LABELS = Map.of(
            PENDING_PAY, "待付款",
            PENDING_SHIP, "待发货",
            SHIPPED, "已发货",
            PENDING_RECEIVE, "待收货",
            COMPLETED, "已完成",
            CANCELLED, "已取消",
            REFUNDING, "退款中",
            REFUNDED, "已退款");

    /**
     * 允许的状态流转。终态（已取消 / 已退款）没有出边 —— 想改只能走新的业务动作。
     *
     * <p>两处与直觉不同的地方，都是照着现有写入方核对出来的，不是设计出来的：</p>
     * <ul>
     *   <li>SHIPPED 可直接到 COMPLETED：PC 端「确认收货」与自动确收都算收货，
     *       中间那一档 PENDING_RECEIVE 由物流协同写入，不是必经环节；</li>
     *   <li>已支付的四档都能直接到 REFUNDED：{@code AfterSaleRefundService} 全额退款时就这么写
     *       （不先绕一圈 REFUNDING）。如果表里不给这条边，流转表就和真实写入方不一致，
     *       下一次把它接进结算/退款判断时就会误拒合法业务。</li>
     * </ul>
     */
    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
            PENDING_PAY, Set.of(PENDING_SHIP, CANCELLED),
            PENDING_SHIP, Set.of(SHIPPED, CANCELLED, REFUNDING, REFUNDED),
            SHIPPED, Set.of(PENDING_RECEIVE, COMPLETED, REFUNDING, REFUNDED),
            PENDING_RECEIVE, Set.of(COMPLETED, REFUNDING, REFUNDED),
            COMPLETED, Set.of(REFUNDING, REFUNDED),
            REFUNDING, Set.of(REFUNDED, COMPLETED),
            CANCELLED, Set.of(),
            REFUNDED, Set.of());

    /**
     * 「钱已经付了」的状态集合：渠道等级考核按它统计有效 GMV。
     * 注意含 REFUNDING —— 退款中的订单在退款完成前仍算已成交，否则渠道会因为一笔售后被降级。
     */
    public static final List<String> PAID_STATUSES = List.of(PENDING_SHIP, SHIPPED, PENDING_RECEIVE, COMPLETED, REFUNDING);

    /** 可申请售后的状态（与 PAID_STATUSES 同一份口径，不再各写一份列表） */
    public static final List<String> AFTER_SALE_ALLOWED = PAID_STATUSES;

    private OrderStatus() {
    }

    public static String label(String status) {
        if (status == null) {
            return "";
        }
        return LABELS.getOrDefault(status, status);
    }

    public static boolean known(String status) {
        return status != null && LABELS.containsKey(status);
    }

    /** 这一跳合不合法。未知状态一律不合法（宁可拒绝，也不放行了再解释）。 */
    public static boolean canTransition(String from, String to) {
        if (!known(from) || !known(to)) {
            return false;
        }
        return TRANSITIONS.get(from).contains(to);
    }

    /** 拒绝原因要说得出口：光回"操作失败"用户只能重试或提工单。 */
    public static String rejectReason(String from, String to) {
        String targetLabel = label(to);
        if (!known(from)) {
            return "订单当前状态无法识别（" + from + "），不能" + targetLabel;
        }
        if (from.equals(to)) {
            return "订单已经" + targetLabel + "，无需重复操作";
        }
        return "订单「" + label(from) + "」不能" + targetLabel;
    }
}
