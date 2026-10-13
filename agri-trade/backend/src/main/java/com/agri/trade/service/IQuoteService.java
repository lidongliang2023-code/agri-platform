package com.agri.trade.service;

import com.agri.trade.entity.Quote;
import com.baomidou.mybatisplus.core.metadata.IPage;
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

    /**
     * 报价分页查询。
     *
     * <p>原先只有"按买家/按卖家取全部"和"按询价单取列表"三种查法，没有分页接口 ——
     * 报价列表页因此无处可取数（前端调的是 /api/trade/quote/list，后端根本没有这个路径）。</p>
     */
    IPage<Quote> getQuotePage(int pageNum, int pageSize, String quoteStatus, Long sellerId, Long buyerId);
}
