package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.mapper.OrderMapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 订单发货协同：供应商与渠道任一方提交物流信息，另一方确认后才置为已发货。
 *
 * <p>无渠道归属的直购单由供应商提交即确认；平台运营仍保留直接发货的应急通道，
 * 不计入双方协同记录。</p>
 */
@Service
public class OrderShipmentService {

    private final JdbcTemplate jdbc;
    private final OrderMapper orderMapper;
    private final NoticeService noticeService;

    public OrderShipmentService(JdbcTemplate jdbc, OrderMapper orderMapper, NoticeService noticeService) {
        this.jdbc = jdbc;
        this.orderMapper = orderMapper;
        this.noticeService = noticeService;
    }

    @Transactional
    public Map<String, Object> propose(Long orderId, String actorType, Long actorId,
                                       String logisticsNo, String company) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) return fail("订单不存在");
        if (!"PENDING_SHIP".equals(order.getStatus())) return fail("当前状态不可发货：" + order.getStatus());
        String no = logisticsNo == null ? "" : logisticsNo.trim();
        if (no.isEmpty()) return fail("请填写物流单号");
        Map<String, Object> pending = pendingProposal(orderId);
        if (pending != null) return fail("已有待确认的发货信息，请先确认或驳回");

        String counterpartType = "SUPPLIER".equals(actorType) ? "CHANNEL" : "SUPPLIER";
        boolean counterpartExists = "SUPPLIER".equals(counterpartType)
                ? order.getSupplierId() != null
                : order.getChannelId() != null;
        String status = counterpartExists ? "PROPOSED" : "CONFIRMED";
        String orderConfirmStatus = counterpartExists ? "PENDING" : "CONFIRMED";
        Long proposalId = IdWorker.getId();
        jdbc.update("INSERT INTO s2b2c_order_shipment (id, order_id, proposer_type, proposer_id, logistics_no, "
                        + "logistics_company, status, confirmed_by_type, confirmed_by_id, confirmed_at, create_time) "
                        + "VALUES (?,?,?,?,?,?,?,?,?,?,NOW())",
                proposalId, orderId, actorType, actorId, no,
                company == null || company.isBlank() ? "云仓/直发" : company.trim(),
                status, counterpartExists ? null : actorType, counterpartExists ? null : actorId,
                counterpartExists ? null : LocalDateTime.now());

        order.setShipConfirmStatus(orderConfirmStatus);
        order.setShipProposedBy(actorType);
        if (!counterpartExists) {
            order.setStatus("SHIPPED");
            order.setLogisticsNo(no);
            order.setLogisticsCompany(company == null || company.isBlank() ? "云仓/直发" : company.trim());
        }
        order.setUpdateTime(LocalDateTime.now());
        orderMapper.updateById(order);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("proposalId", String.valueOf(proposalId));
        result.put("status", status);
        if (counterpartExists) {
            if ("SUPPLIER".equals(actorType)) {
                noticeService.notify("CHANNEL", order.getChannelId(), "SHIP_PROPOSED", "新的发货信息待确认",
                        "订单 " + order.getOrderNo() + " 提交发货：" + no + "，请确认", "ORDER", orderId);
            } else {
                noticeService.notify("SUPPLIER", order.getSupplierId(), "SHIP_PROPOSED", "新的发货信息待确认",
                        "订单 " + order.getOrderNo() + " 提交发货：" + no + "，请确认", "ORDER", orderId);
            }
        }
        result.put("message", counterpartExists ? "已提交发货信息，等待对方确认" : "无渠道订单已直接发货");
        return result;
    }

    @Transactional
    public Map<String, Object> confirm(Long orderId, String actorType, Long actorId) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) return fail("订单不存在");
        Map<String, Object> pending = pendingProposal(orderId);
        if (pending == null) return fail("没有待确认的发货信息");
        if (actorType.equals(String.valueOf(pending.get("proposer_type")))) {
            return fail("不能确认自己提交的发货信息");
        }
        jdbc.update("UPDATE s2b2c_order_shipment SET status = 'CONFIRMED', confirmed_by_type = ?, "
                        + "confirmed_by_id = ?, confirmed_at = NOW(), update_time = NOW() WHERE id = ?",
                actorType, actorId, pending.get("id"));
        order.setStatus("SHIPPED");
        order.setLogisticsNo(String.valueOf(pending.get("logistics_no")));
        order.setLogisticsCompany(String.valueOf(pending.get("logistics_company")));
        order.setShipConfirmStatus("CONFIRMED");
        order.setUpdateTime(LocalDateTime.now());
        orderMapper.updateById(order);
        notifyProposer(order, pending, "SHIP_CONFIRMED", "发货已确认", "订单 " + order.getOrderNo() + " 已确认发货");
        return success("已确认发货，物流单号已回传");
    }

    @Transactional
    public Map<String, Object> reject(Long orderId, String actorType, Long actorId, String reason) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) return fail("订单不存在");
        Map<String, Object> pending = pendingProposal(orderId);
        if (pending == null) return fail("没有待确认的发货信息");
        if (actorType.equals(String.valueOf(pending.get("proposer_type")))) {
            return fail("不能驳回自己提交的发货信息");
        }
        String text = reason == null ? "" : reason.trim();
        if (text.isEmpty()) return fail("驳回必须填写原因");
        jdbc.update("UPDATE s2b2c_order_shipment SET status = 'REJECTED', reason = ?, confirmed_by_type = ?, "
                        + "confirmed_by_id = ?, confirmed_at = NOW(), update_time = NOW() WHERE id = ?",
                text, actorType, actorId, pending.get("id"));
        order.setShipConfirmStatus("REJECTED");
        order.setUpdateTime(LocalDateTime.now());
        orderMapper.updateById(order);
        notifyProposer(order, pending, "SHIP_REJECTED", "发货信息被驳回",
                "订单 " + order.getOrderNo() + " 的发货信息被驳回：" + text);
        return success("已驳回发货信息，请对方修改后重新提交");
    }

    @Transactional
    public Map<String, Object> withdraw(Long orderId, String actorType, Long actorId) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) return fail("订单不存在");
        Map<String, Object> pending = pendingProposal(orderId);
        if (pending == null) return fail("没有待确认的发货信息");
        if (!actorType.equals(String.valueOf(pending.get("proposer_type")))
                || !String.valueOf(actorId).equals(String.valueOf(pending.get("proposer_id")))) {
            return fail("只能撤回自己提交的发货信息");
        }
        jdbc.update("UPDATE s2b2c_order_shipment SET status = 'CANCELLED', update_time = NOW() WHERE id = ?",
                pending.get("id"));
        order.setShipConfirmStatus("NONE");
        order.setShipProposedBy(null);
        order.setUpdateTime(LocalDateTime.now());
        orderMapper.updateById(order);
        String targetType = "SUPPLIER".equals(actorType) ? "CHANNEL" : "SUPPLIER";
        Long targetId = "CHANNEL".equals(targetType) ? order.getChannelId() : order.getSupplierId();
        noticeService.notify(targetType, targetId, "SHIP_WITHDRAWN", "发货信息已撤回",
                "订单 " + order.getOrderNo() + " 的发货信息已被对方撤回", "ORDER", orderId);
        return success("已撤回发货信息");
    }

    public Map<String, Object> latest(Long orderId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, order_id AS orderId, proposer_type AS proposerType, proposer_id AS proposerId, "
                        + "logistics_no AS logisticsNo, logistics_company AS logisticsCompany, status, reason, "
                        + "confirmed_by_type AS confirmedByType, confirmed_at AS confirmedAt, create_time AS createTime "
                        + "FROM s2b2c_order_shipment WHERE order_id = ? ORDER BY create_time DESC, id DESC LIMIT 1", orderId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void notifyProposer(Order order, Map<String, Object> pending, String type, String title, String content) {
        String proposerType = String.valueOf(pending.get("proposer_type"));
        Long proposerId = pending.get("proposer_id") == null ? null : ((Number) pending.get("proposer_id")).longValue();
        noticeService.notify(proposerType, proposerId, type, title, content, "ORDER", order.getId());
    }

    private Map<String, Object> pendingProposal(Long orderId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, proposer_type, proposer_id, logistics_no, logistics_company FROM s2b2c_order_shipment "
                        + "WHERE order_id = ? AND status = 'PROPOSED' ORDER BY create_time DESC, id DESC LIMIT 1", orderId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Map<String, Object> success(String message) {
        return new HashMap<>(Map.of("success", true, "message", message));
    }

    private Map<String, Object> fail(String message) {
        return new HashMap<>(Map.of("success", false, "message", message));
    }
}
