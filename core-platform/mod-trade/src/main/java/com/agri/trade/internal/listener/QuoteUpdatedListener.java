package com.agri.trade.internal.listener;

import com.agri.core.infra.event.TopicListener;
import com.agri.core.infra.util.JsonUtil;
import com.agri.service.api.event.ServiceEvents;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 交易域消费「行情已更新」：撮合参考价刷新（MVP 记录日志；后续驱动挂牌参考价与撮合建议）。
 */
@Slf4j
@Component
public class QuoteUpdatedListener implements TopicListener {

    @Override
    public String topic() {
        return ServiceEvents.QUOTE_UPDATED;
    }

    @Override
    public void onMessage(String payload) {
        ServiceEvents.QuoteUpdated event = JsonUtil.parse(payload, ServiceEvents.QuoteUpdated.class);
        log.info("[order] 消费 quote.updated: {} 参考价 {}（{}%）",
                event.productName(), event.price(), event.changePct());
    }
}
