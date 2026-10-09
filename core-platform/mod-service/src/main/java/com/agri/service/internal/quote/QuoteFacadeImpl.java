package com.agri.service.internal.quote;

import com.agri.service.api.facade.QuoteFacade;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * 行情 OHS 门面实现。
 */
@Service
@RequiredArgsConstructor
public class QuoteFacadeImpl implements QuoteFacade {

    private final QuoteService quoteService;

    @Override
    public BigDecimal latestPrice(String productName) {
        var quote = quoteService.latest(productName);
        return quote == null ? null : quote.getPrice();
    }
}
