package com.agri.s2b2c.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/** 每天 04:00 自动确认收货；可通过配置关闭。 */
@Component
public class OrderAutoCompleteScheduler {

    private static final Logger log = LoggerFactory.getLogger(OrderAutoCompleteScheduler.class);

    private final OrderAutoCompleteService orderAutoCompleteService;

    @Value("${agri.s2b2c.order-auto-complete.enabled:true}")
    private boolean enabled;

    public OrderAutoCompleteScheduler(OrderAutoCompleteService orderAutoCompleteService) {
        this.orderAutoCompleteService = orderAutoCompleteService;
    }

    @Scheduled(cron = "${agri.s2b2c.order-auto-complete.cron:0 0 4 * * ?}")
    public void autoCompleteOrders() {
        if (!enabled) return;
        try {
            Map<String, Object> result = orderAutoCompleteService.completeExpired(0);
            if (((Number) result.get("completed")).intValue() > 0) {
                log.info("订单自动确认收货完成：{}", result);
            }
        } catch (RuntimeException e) {
            log.error("订单自动确认收货失败", e);
        }
    }
}