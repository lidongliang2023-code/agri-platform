package com.agri.trade.service;

import com.agri.trade.entity.Inquiry;
import com.agri.trade.entity.Quote;
import com.agri.trade.entity.Demand;
import com.agri.trade.entity.TradeProduct;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface IInquiryService extends IService<Inquiry> {

    Inquiry createInquiry(Long demandId, Long productId, Long buyerId);

    Inquiry createInquiryFromDemand(Demand demand, Long productId);

    List<Inquiry> batchCreateInquiries(Long demandId, List<Long> productIds, Long buyerId);

    List<Inquiry> getInquiriesByBuyer(Long buyerId);

    List<Inquiry> getInquiriesBySeller(Long sellerId);

    List<Quote> getQuotesByInquiry(Long inquiryId);

    void updateInquiryStatus(Long inquiryId, String status);

    void convertToOrder(Long inquiryId, Long quoteId);
}