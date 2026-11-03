package com.agri.s2b2c.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 超时未支付订单自动取消：复用取消服务，库存/券/活动预算/拼团权益一并回补。
 */
@Service
public class OrderTimeoutService {

    private final JdbcTemplate jdbc;
    private final OrderCancellationService orderCancellationService;

    @Value("${agri.s2b2c.order-timeout.minutes:30}")
    private int defaultMinutes;

    public OrderTimeoutService(JdbcTemplate jdbc, OrderCancellationService orderCancellationService) {
        this.jdbc = jdbc;
        this.orderCancellationService = orderCancellationService;
    }

    public Map<String, Object> cancelExpired(int minutes) {
        int range = minutes > 0 ? minutes : defaultMinutes;
        List<Long> ids = jdbc.queryForList(
                "SELECT id FROM s2b2c_order WHERE status = 'PENDING_PAY' "
                        + "AND create_time < DATE_SUB(NOW(), INTERVAL ? MINUTE) "
                        + "ORDER BY create_time ASC LIMIT 200", Long.class, range);
        int cancelled = 0;
        int failed = 0;
        for (Long id : ids) {
            try {
                if (orderCancellationService.cancel(id, "超时未支付自动取消")) {
                    cancelled++;
                }
            } catch (RuntimeException e) {
                failed++;
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("minutes", range);
        result.put("scanned", ids.size());
        result.put("cancelled", cancelled);
        result.put("failed", failed);
        return result;
    }
}