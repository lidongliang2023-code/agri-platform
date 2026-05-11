package com.agri.trade.service;

import com.agri.trade.entity.Quote;
import com.baomidou.mybatisplus.extension.service.IService;

import java.math.BigDecimal;
import java.util.List;

public interface IQuoteService extends IService<Quote> {

    Quote createQuote(Long inquiryId, BigDecimal unitPrice, BigDecimal quantity, 
                      BigDecimal freightAmount, String remark);

    List<Quote> getQuotesByBuyer(Long buyerId);

    List<Quote> getQuotesBySeller(Long sellerId);

    void acceptQuote(Long quoteId);

    void rejectQuote(Long quoteId, String reason);

    Quote getQuoteByInquiryAndSeller(Long inquiryId, Long sellerId);
}