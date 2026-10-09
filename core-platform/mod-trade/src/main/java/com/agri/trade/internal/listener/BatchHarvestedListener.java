package com.agri.trade.internal.listener;

import com.agri.core.infra.event.TopicListener;
import com.agri.core.infra.util.JsonUtil;
import com.agri.platform.api.facade.ProductFacade;
import com.agri.produce.api.event.ProduceEvents;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 交易域消费「批次已采收」（图 3 溯源契约）：把批次溯源码挂载到交易商品，形成信任资产。
 * 消费端幂等：attachTraceCode 为幂等赋值操作。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BatchHarvestedListener implements TopicListener {

    private final ProductFacade productFacade;

    @Override
    public String topic() {
        return ProduceEvents.BATCH_HARVESTED;
    }

    @Override
    public void onMessage(String payload) {
        ProduceEvents.BatchHarvested event = JsonUtil.parse(payload, ProduceEvents.BatchHarvested.class);
        log.info("[order] 消费 batch.harvested: batch={}, product={}", event.batchCode(), event.productId());
        productFacade.attachTraceCode(event.productId(), event.batchCode());
    }
}
