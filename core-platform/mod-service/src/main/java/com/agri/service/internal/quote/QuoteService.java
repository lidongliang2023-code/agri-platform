package com.agri.service.internal.quote;

import com.agri.core.infra.event.DomainEventPublisher;
import com.agri.service.api.event.ServiceEvents;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 行情服务：发布行情（同事务落本地消息表 + quote.updated 事件）/ 查询。
 */
@Service
@RequiredArgsConstructor
public class QuoteService {

    private final QuoteMapper quoteMapper;
    private final DomainEventPublisher eventPublisher;

    @Transactional
    public QuoteEntity publish(String productName, String category, BigDecimal price,
                               BigDecimal changePct, String source) {
        QuoteEntity quote = new QuoteEntity();
        quote.setProductName(productName);
        quote.setCategory(category);
        quote.setPrice(price);
        quote.setChangePct(changePct);
        quote.setSource(source);
        quote.setQuotedAt(LocalDateTime.now());
        quoteMapper.insert(quote);

        eventPublisher.publish(ServiceEvents.QUOTE_UPDATED, "quote-" + quote.getId(),
                new ServiceEvents.QuoteUpdated(quote.getId(), quote.getProductName(), quote.getCategory(),
                        quote.getPrice(), quote.getChangePct(), quote.getMarketId(),
                        quote.getQuotedAt().toString()));
        return quote;
    }

    public PageResult<QuoteEntity> page(long page, long size, String keyword) {
        Page<QuoteEntity> result = quoteMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<QuoteEntity>()
                        .like(keyword != null && !keyword.isBlank(), QuoteEntity::getProductName, keyword)
                        .orderByDesc(QuoteEntity::getQuotedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    public QuoteEntity latest(String productName) {
        return quoteMapper.selectOne(new LambdaQueryWrapper<QuoteEntity>()
                .eq(QuoteEntity::getProductName, productName)
                .orderByDesc(QuoteEntity::getQuotedAt)
                .last("LIMIT 1"));
    }
}
