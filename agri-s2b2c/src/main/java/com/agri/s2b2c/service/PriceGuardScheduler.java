package com.agri.s2b2c.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/** 每日价盘巡检：全量执行价格守卫，自动下架低于底价的渠道货架并留痕。 */
@Component
public class PriceGuardScheduler {

    private static final Logger log = LoggerFactory.getLogger(PriceGuardScheduler.class);

    private final PriceGuardService priceGuardService;

    @Value("${agri.s2b2c.price-guard.enabled:true}")
    private boolean enabled;

    public PriceGuardScheduler(PriceGuardService priceGuardService) {
        this.priceGuardService = priceGuardService;
    }

    @Scheduled(cron = "${agri.s2b2c.price-guard.cron:0 30 8 * * ?}")
    public void scanDaily() {
        if (!enabled) return;
        try {
            Map<String, Object> result = priceGuardService.scanAll("SCHEDULED");
            log.info("价盘巡检（每日）完成：{}", result);
        } catch (RuntimeException e) {
            log.error("价盘巡检（每日）失败", e);
        }
    }
}
