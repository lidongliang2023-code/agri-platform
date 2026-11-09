package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.entity.OrderItem;
import com.agri.s2b2c.integration.ProductionTraceClient;
import com.agri.s2b2c.mapper.OrderItemMapper;
import com.agri.s2b2c.mapper.OrderMapper;
import com.agri.s2b2c.security.SecurityUtils;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

/** 商城只维护零售履约事实；生产事实及码有效性由生产域提供。 */
@Service
public class OrderTraceService {
    private final JdbcTemplate jdbc;
    private final OrderMapper orders;
    private final OrderItemMapper items;
    private final ProductionTraceClient production;
    private final ProductionTraceQueryService query;
    public OrderTraceService(JdbcTemplate jdbc, OrderMapper orders, OrderItemMapper items,
                             ProductionTraceClient production, ProductionTraceQueryService query) {
        this.jdbc = jdbc; this.orders = orders; this.items = items; this.production = production; this.query = query;
    }
    public void requireSupplyOrder(Long orderId, Long sourceId) {
        Order order = orders.selectById(orderId);
        if (order == null || !Objects.equals(order.getSupplierId(), sourceId))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "订单不属于当前货源档案");
    }
    public OrderItem requireItem(Long orderId, Long itemId) {
        OrderItem item = items.selectById(itemId);
        if (item == null || !Objects.equals(item.getOrderId(), orderId))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "订单商品不存在");
        return item;
    }
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> bind(Long orderId, Long itemId, List<String> codes, Long supplySource) {
        jdbc.queryForList("SELECT id FROM s2b2c_order WHERE id = ? FOR UPDATE", orderId);
        Order order = orders.selectById(orderId);
        if (order == null || !Objects.equals(order.getSupplierId(), supplySource))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "订单不属于当前货源档案");
        if (!"PENDING_SHIP".equals(order.getStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "仅待发货订单可绑定单品码");
        OrderItem item = requireItem(orderId, itemId);
        if (item.getProdBatchNo() == null || item.getProdBatchNo().isBlank())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "订单没有来源批次快照，不能根据当前商品补造历史来源");
        if (codes == null || codes.isEmpty() || codes.size() > 1000 || !Objects.equals(codes.size(), item.getQuantity()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "每件销售单位绑定一个码，码数量须等于商品数量且不超过1000");
        LinkedHashSet<String> distinct = new LinkedHashSet<>();
        for (String code : codes) {
            if (code == null || code.isBlank() || code.trim().length() > 100 || !distinct.add(code.trim()))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "码值不能为空、超长或重复");
        }
        if (jdbc.queryForObject("SELECT COUNT(*) FROM s2b2c_order_trace_unit WHERE order_item_id = ?", Long.class, itemId) > 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该商品已完成绑定，不允许覆盖历史流转记录");
        // 先校验全部码，再一次性落库；唯一索引仲裁跨订单并发占用。
        for (String code : distinct) {
            Map<String, Object> verified = production.codeTrace(code, SecurityUtils.getToken());
            if (verified == null || !Boolean.TRUE.equals(verified.get("verifiable")))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "单品码不存在、未激活或质检无效：" + code);
            if (!item.getProdBatchNo().equals(String.valueOf(verified.get("batchNo"))))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "单品码批次与订单来源不一致：" + code);
        }
        for (String code : distinct) jdbc.update(
            "INSERT INTO s2b2c_order_trace_unit(trace_code,order_id,order_item_id,batch_no,create_time) VALUES (?,?,?,?,CURRENT_TIMESTAMP)",
            code, orderId, itemId, item.getProdBatchNo());
        return Map.of("success", true, "message", "单品码已绑定", "count", distinct.size());
    }
    public void requireShippable(Long orderId) {
        List<OrderItem> lines = items.selectList(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<OrderItem>()
                .eq(OrderItem::getOrderId, orderId));
        for (OrderItem item : lines) {
            if (item.getProdBatchNo() == null || item.getProdBatchNo().isBlank()) continue;
            List<String> codes = jdbc.queryForList("SELECT trace_code FROM s2b2c_order_trace_unit WHERE order_item_id=?", String.class, item.getId());
            if (item.getQuantity() == null || codes.size() != item.getQuantity())
                throw new ResponseStatusException(HttpStatus.CONFLICT, "来源商品尚未按数量完成单品码绑定：" + item.getName());
            for (String code : codes) {
                Map<String, Object> trace = production.codeTrace(code, SecurityUtils.getToken());
                if (trace == null || !Boolean.TRUE.equals(trace.get("verifiable"))
                        || !item.getProdBatchNo().equals(String.valueOf(trace.get("batchNo"))))
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "出货单品码失效或来源不一致：" + code);
            }
        }
    }
    public Map<String, Object> itemTrace(Long orderId, Long itemId) {
        OrderItem item = requireItem(orderId, itemId);
        Map<String, Object> result = new LinkedHashMap<>(query.batchTrace(item.getProdBatchNo(), item.getName(), null));
        result.put("sourceBasis", "ORDER_SNAPSHOT");
        result.put("reason", item.getProdBatchNo() == null ? "历史订单未记录来源批次" : result.get("reason"));
        result.put("units", jdbc.queryForList("SELECT trace_code AS traceCode, batch_no AS batchNo, create_time AS boundAt FROM s2b2c_order_trace_unit WHERE order_item_id=? ORDER BY trace_code", itemId));
        Order order = orders.selectById(orderId);
        result.put("orderStatus", order.getStatus());
        result.put("logisticsCompany", order.getLogisticsCompany());
        result.put("logisticsNo", order.getLogisticsNo());
        return result;
    }
}
