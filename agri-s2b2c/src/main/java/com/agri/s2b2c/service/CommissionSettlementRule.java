package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Commission;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 「这笔佣金现在到底能不能结算」—— 唯一判定处。
 *
 * <p>存在的理由是一个真实的资金口径漏洞：佣金在<b>下单时</b>就按订单金额生成并置 PENDING
 * （{@code OrderServiceImpl} 拆单里），而结算原先只按 {@code status='PENDING'} 筛，
 * <b>完全不问订单怎么样了</b>。于是买家下完单不付款、或者付款后申请退款，
 * 运营端点一次「批量结算」就能把佣金结给渠道并进入提现打款 —— 钱先付出去了，货根本没成交。</p>
 *
 * <p>口径（只在这里定义一次，结算与页面提示都读它）：
 * <ol>
 *   <li>关联订单必须<b>已完成</b>（买家确认收货）—— 未付款 / 待发货 / 在途都不产生可结佣金；</li>
 *   <li>订单不能是已取消 / 已退款；退款中同样挡住，等退款结论出来再说；</li>
 *   <li>订单上不能有<b>进行中的售后</b>（PENDING / APPROVED / RETURNING）——
 *       售后可能改成全额退款，先结后驳回就要往回追钱；</li>
 *   <li>订单行查不到（历史孤儿数据）也挡，并说明是"关联订单已不存在"。</li>
 * </ol>
 *
 * <p>不满足的必须<b>说得出原因</b>：结算页只报"结算 0 笔"，操作员会以为是按钮坏了，
 * 或者干脆再点一次。把排除原因如实回显，才谈得上"这功能是可用的"。</p>
 */
@Service
@RequiredArgsConstructor
public class CommissionSettlementRule {

    /** 会挡住结算的售后状态（COMPLETED / REJECTED 是终态，不挡） */
    private static final Set<String> OPEN_AFTER_SALE = Set.of("PENDING", "APPROVED", "RETURNING");

    private final JdbcTemplate jdbc;

    /** 一条佣金的判定结果。{@code reason} 为 null 表示可以结算。 */
    public record Verdict(Long commissionId, Long orderId, String orderStatus, String reason) {
        public boolean settleable() {
            return reason == null;
        }
    }

    /**
     * 批量判定：两条 IN 查询（订单状态 + 进行中售后），不按佣金条数发查询。
     *
     * @return 与入参同序的判定列表；入参为空返回空列表
     */
    public List<Verdict> evaluate(List<Commission> commissions) {
        if (commissions == null || commissions.isEmpty()) {
            return List.of();
        }
        Set<Long> orderIds = new LinkedHashSet<>();
        for (Commission commission : commissions) {
            if (commission.getOrderId() != null) {
                orderIds.add(commission.getOrderId());
            }
        }
        Map<Long, String> statusByOrder = orderStatuses(orderIds);
        Set<Long> openAfterSaleOrders = openAfterSaleOrderIds(orderIds);
        List<Verdict> verdicts = new java.util.ArrayList<>(commissions.size());
        for (Commission commission : commissions) {
            Long orderId = commission.getOrderId();
            String status = orderId == null ? null : statusByOrder.get(orderId);
            verdicts.add(new Verdict(commission.getId(), orderId, status,
                    reasonOf(orderId, status, openAfterSaleOrders)));
        }
        return verdicts;
    }

    /** 判定文案（页面与结算回执共用，避免"页面上说能结、后端却不结"）。 */
    private String reasonOf(Long orderId, String status, Set<Long> openAfterSaleOrders) {
        if (orderId == null) {
            return "佣金没有关联订单，无法核对成交事实";
        }
        if (status == null) {
            return "关联订单已不存在（订单 " + orderId + "）";
        }
        switch (status) {
            case OrderStatus.PENDING_PAY:
                return "买家尚未付款";
            case OrderStatus.CANCELLED:
                return "订单已取消";
            case OrderStatus.REFUNDING:
                return "订单退款中，等退款结论";
            case OrderStatus.REFUNDED:
                return "订单已退款";
            case OrderStatus.PENDING_SHIP:
                return "订单未发货";
            case OrderStatus.SHIPPED:
            case OrderStatus.PENDING_RECEIVE:
                return "买家尚未确认收货";
            default:
                break;
        }
        if (!OrderStatus.COMPLETED.equals(status)) {
            // 词表里没有的状态：不猜它能结算，交给人看
            return "订单状态无法识别（" + status + "）";
        }
        if (openAfterSaleOrders.contains(orderId)) {
            return "订单有处理中的售后";
        }
        return null;
    }

    private Map<Long, String> orderStatuses(Set<Long> orderIds) {
        if (orderIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> result = new LinkedHashMap<>();
        jdbc.query("SELECT id, status FROM s2b2c_order WHERE id IN (" + placeholders(orderIds.size()) + ")",
                rs -> {
                    result.put(rs.getLong("id"), rs.getString("status"));
                }, orderIds.toArray());
        return result;
    }

    private Set<Long> openAfterSaleOrderIds(Set<Long> orderIds) {
        if (orderIds.isEmpty()) {
            return Set.of();
        }
        Object[] args = orderIds.toArray();
        String marks = placeholders(args.length);
        Set<Long> result = new LinkedHashSet<>();
        jdbc.query("SELECT DISTINCT order_id FROM s2b2c_after_sale WHERE status IN ('PENDING','APPROVED','RETURNING') "
                        + "AND order_id IN (" + marks + ")",
                rs -> {
                    result.add(rs.getLong("order_id"));
                }, args);
        return result;
    }

    /**
     * 只生成 {@code ?,?,?} 形式的占位符，参数一律走绑定 —— 订单 id 来自库里而不是用户输入，
     * 但拼接 SQL 的习惯不该在资金链路上开口子。
     */
    private static String placeholders(int count) {
        return String.join(",", java.util.Collections.nCopies(count, "?"));
    }
}
