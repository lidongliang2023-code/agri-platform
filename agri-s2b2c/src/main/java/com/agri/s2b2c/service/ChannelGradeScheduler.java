package com.agri.s2b2c.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/** 每月 1 日 03:00 自动考核渠道等级，可在配置中关闭。 */
@Component
public class ChannelGradeScheduler {

    private static final Logger log = LoggerFactory.getLogger(ChannelGradeScheduler.class);

    private final ChannelGradeService channelGradeService;

    @Value("${agri.s2b2c.grade.enabled:true}")
    private boolean enabled;

    public ChannelGradeScheduler(ChannelGradeService channelGradeService) {
        this.channelGradeService = channelGradeService;
    }

    @Scheduled(cron = "${agri.s2b2c.grade.cron:0 0 3 1 * ?}")
    public void evaluateMonthly() {
        if (!enabled) return;
        try {
            Map<String, Object> result = channelGradeService.evaluate(30, "系统定时");
            log.info("渠道等级月度考核完成：{}", result);
        } catch (RuntimeException e) {
            log.error("渠道等级月度考核失败", e);
        }
    }
}