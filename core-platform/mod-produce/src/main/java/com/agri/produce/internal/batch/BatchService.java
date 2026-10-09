package com.agri.produce.internal.batch;

import com.agri.core.infra.event.DomainEventPublisher;
import com.agri.produce.api.event.ProduceEvents;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 批次应用服务：建批 → 采收（发布 batch.harvested，驱动溯源码挂载到交易商品，8.4 溯源贯穿）。
 */
@Service
@RequiredArgsConstructor
public class BatchService {

    private static final DateTimeFormatter CODE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final BatchMapper batchMapper;
    private final DomainEventPublisher eventPublisher;

    @Transactional
    public BatchEntity create(Long plotId, Long productId, BigDecimal quantity) {
        BatchEntity batch = new BatchEntity();
        batch.setBatchCode("PH" + CODE_FORMAT.format(LocalDateTime.now())
                + ThreadLocalRandom.current().nextInt(100000, 999999));
        batch.setPlotId(plotId);
        batch.setProductId(productId);
        batch.setQuantity(quantity);
        batch.setStatus("GROWING");
        batchMapper.insert(batch);
        return batch;
    }

    /** 采收：状态流转 + 同一本地事务发布批次采收事件（事件契约即拆分预案） */
    @Transactional
    public BatchEntity harvest(Long batchId) {
        BatchEntity batch = batchMapper.selectById(batchId);
        if (batch == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        if (!"GROWING".equals(batch.getStatus())) {
            throw new BusinessException(ErrorCode.BATCH_NOT_HARVESTABLE);
        }
        batch.setStatus("HARVESTED");
        batch.setHarvestAt(LocalDateTime.now());
        batchMapper.updateById(batch);

        eventPublisher.publish(ProduceEvents.BATCH_HARVESTED, batch.getBatchCode(),
                new ProduceEvents.BatchHarvested(batch.getId(), batch.getBatchCode(), batch.getProductId(),
                        batch.getQuantity(), batch.getMarketId(), batch.getHarvestAt().toString()));
        return batch;
    }

    public PageResult<BatchEntity> page(long page, long size, String status) {
        Page<BatchEntity> result = batchMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<BatchEntity>()
                        .eq(status != null && !status.isBlank(), BatchEntity::getStatus, status)
                        .orderByDesc(BatchEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }
}
