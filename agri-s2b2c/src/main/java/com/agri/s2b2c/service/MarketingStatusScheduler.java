package com.agri.s2b2c.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/** 每小时同步营销活动开始/结束状态。 */
@Component
public class MarketingStatusScheduler {

    private static final Logger log = LoggerFactory.getLogger(MarketingStatusScheduler.class);

    private final MarketingStatusService marketingStatusService;

    @Value("${agri.s2b2c.marketing-status.enabled:true}")
    private boolean enabled;

    public MarketingStatusScheduler(MarketingStatusService marketingStatusService) {
        this.marketingStatusService = marketingStatusService;
    }

    @Scheduled(cron = "${agri.s2b2c.marketing-status.cron:0 0 * * * ?}")
    public void syncStatus() {
        if (!enabled) return;
        try {
            Map<String, Object> result = marketingStatusService.sync();
            log.info("营销活动状态同步：{}", result);
        } catch (RuntimeException e) {
            log.error("营销活动状态同步失败", e);
        }
    }
}