package com.agri.s2b2c.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/** 每 5 分钟清理超时未支付订单；可通过配置关闭。 */
@Component
public class OrderTimeoutScheduler {

    private static final Logger log = LoggerFactory.getLogger(OrderTimeoutScheduler.class);

    private final OrderTimeoutService orderTimeoutService;

    @Value("${agri.s2b2c.order-timeout.enabled:true}")
    private boolean enabled;

    public OrderTimeoutScheduler(OrderTimeoutService orderTimeoutService) {
        this.orderTimeoutService = orderTimeoutService;
    }

    @Scheduled(cron = "${agri.s2b2c.order-timeout.cron:0 */5 * * * ?}")
    public void cancelExpiredOrders() {
        if (!enabled) return;
        try {
            Map<String, Object> result = orderTimeoutService.cancelExpired(0);
            if (((Number) result.get("cancelled")).intValue() > 0) {
                log.info("超时未支付订单清理完成：{}", result);
            }
        } catch (RuntimeException e) {
            log.error("超时未支付订单清理失败", e);
        }
    }
}