package com.agri.s2b2c.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 营销活动状态同步：优惠券按有效期、秒杀/拼团按活动时间窗自动开始/结束。
 * 消费者营销列表与领取接口仍会二次校验有效期，避免脏状态被领取。
 */
@Service
public class MarketingStatusService {

    private final JdbcTemplate jdbc;

    public MarketingStatusService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public Map<String, Object> sync() {
        int couponEnded = jdbc.update(
                "UPDATE s2b2c_coupon SET status = 'ENDED' WHERE status = 'ACTIVE' AND valid_end < CURDATE()");
        int flashStarted = jdbc.update(
                "UPDATE s2b2c_flash_sale SET status = 'ACTIVE' WHERE status = 'UPCOMING' "
                        + "AND start_time <= NOW() AND end_time >= NOW()");
        int flashEnded = jdbc.update(
                "UPDATE s2b2c_flash_sale SET status = 'ENDED' WHERE status IN ('UPCOMING','ACTIVE') AND end_time < NOW()");
        int groupStarted = jdbc.update(
                "UPDATE s2b2c_group_buy SET status = 'ACTIVE' WHERE status = 'UPCOMING' "
                        + "AND start_time <= NOW() AND end_time >= NOW()");
        int groupEnded = jdbc.update(
                "UPDATE s2b2c_group_buy SET status = 'ENDED' WHERE status IN ('UPCOMING','ACTIVE') AND end_time < NOW()");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("couponEnded", couponEnded);
        result.put("flashStarted", flashStarted);
        result.put("flashEnded", flashEnded);
        result.put("groupStarted", groupStarted);
        result.put("groupEnded", groupEnded);
        return result;
    }
}