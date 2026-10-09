package com.agri.trade.internal.settlement;

import com.agri.trade.internal.order.TradeOrderEntity;
import com.agri.trade.internal.order.TradeOrderService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * T+1 结算批处理：每日 01:00 将已支付订单批量结算（无会话 → 系统模式，可跨市场）。
 * 三方对账（平台·支付渠道·银行）由对账子系统后续接入，与结算任务解耦。
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "agri.trade.settlement.enabled", havingValue = "true", matchIfMissing = true)
public class SettlementJob {

    private final TradeOrderService orderService;
    private final com.agri.trade.internal.order.TradeOrderMapper orderMapper;

    @Scheduled(cron = "${agri.trade.settlement.cron:0 0 1 * * ?}")
    public void settlePaidOrders() {
        List<TradeOrderEntity> paid = orderMapper.selectList(new LambdaQueryWrapper<TradeOrderEntity>()
                .eq(TradeOrderEntity::getStatus, "PAID")
                .last("LIMIT 500"));
        int ok = 0;
        for (TradeOrderEntity order : paid) {
            try {
                orderService.settle(order.getId());
                ok++;
            } catch (Exception e) {
                log.error("结算失败: orderId={}, {}", order.getId(), e.getMessage(), e);
            }
        }
        if (!paid.isEmpty()) {
            log.info("T+1 结算完成: 成功 {}/{}", ok, paid.size());
        }
    }
}
