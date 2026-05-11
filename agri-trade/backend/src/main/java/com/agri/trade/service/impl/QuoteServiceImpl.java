package com.agri.trade.service.impl;

import com.agri.trade.entity.Quote;
import com.agri.trade.entity.Inquiry;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.QuoteMapper;
import com.agri.trade.mapper.InquiryMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.service.IQuoteService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class QuoteServiceImpl extends ServiceImpl<QuoteMapper, Quote> implements IQuoteService {

    private final InquiryMapper inquiryMapper;
    private final TradeProductMapper productMapper;

    @Override
    @Transactional
    public Quote createQuote(Long inquiryId, BigDecimal unitPrice, BigDecimal quantity,
                            BigDecimal freightAmount, String remark) {
        Inquiry inquiry = inquiryMapper.selectById(inquiryId);
        if (inquiry == null) {
            return null;
        }

        TradeProduct product = productMapper.selectById(inquiry.getProductId());

        Quote quote = new Quote();
        quote.setQuoteNo("QT" + System.currentTimeMillis());
        quote.setInquiryId(inquiryId);
        quote.setInquiryNo(inquiry.getInquiryNo());
        quote.setProductId(inquiry.getProductId());
        quote.setProductName(inquiry.getProductName());
        quote.setBuyerId(inquiry.getBuyerId());
        quote.setBuyerName(inquiry.getBuyerName());
        quote.setSellerId(inquiry.getSellerId());
        quote.setSellerName(inquiry.getSellerName());
        quote.setUnitPrice(unitPrice);
        quote.setQuantity(quantity != null ? quantity : inquiry.getQuantity());
        quote.setUnit(inquiry.getUnit());
        quote.setTotalAmount(unitPrice.multiply(quote.getQuantity()));
        quote.setFreightAmount(freightAmount != null ? freightAmount : BigDecimal.ZERO);
        quote.setDiscountAmount(BigDecimal.ZERO);
        quote.setDeliveryAddress(inquiry.getDeliveryAddress());
        quote.setDeliveryTime(inquiry.getDeliveryDeadline());
        quote.setPayment_terms("prepayment");

        if (product != null) {
            quote.setQualityDescription(product.getDescription());
            quote.setCertificationInfo(product.getCertificationJson());
            quote.setPackagingInfo(product.getSpecSize());
        }

        Date validUntil = new Date();
        validUntil.setTime(validUntil.getTime() + 7 * 24 * 60 * 60 * 1000L);
        quote.setValidUntil(validUntil);
        quote.setQuoteStatus("pending");
        quote.setDelFlag(0);
        quote.setCreateTime(new Date());
        quote.setUpdateTime(new Date());
        quote.setRemark(remark);

        baseMapper.insert(quote);

        inquiry.setReplyCount(inquiry.getReplyCount() != null ? inquiry.getReplyCount() + 1 : 1);
        inquiry.setUpdateTime(new Date());
        inquiryMapper.updateById(inquiry);

        return quote;
    }

    @Override
    public List<Quote> getQuotesByBuyer(Long buyerId) {
        LambdaQueryWrapper<Quote> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Quote::getBuyerId, buyerId);
        wrapper.eq(Quote::getDelFlag, 0);
        wrapper.orderByDesc(Quote::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<Quote> getQuotesBySeller(Long sellerId) {
        LambdaQueryWrapper<Quote> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Quote::getSellerId, sellerId);
        wrapper.eq(Quote::getDelFlag, 0);
        wrapper.orderByDesc(Quote::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public void acceptQuote(Long quoteId) {
        Quote quote = baseMapper.selectById(quoteId);
        if (quote != null) {
            quote.setQuoteStatus("accepted");
            quote.setBuyerResponse("accepted");
            quote.setResponseTime(new Date());
            quote.setUpdateTime(new Date());
            baseMapper.updateById(quote);
        }
    }

    @Override
    public void rejectQuote(Long quoteId, String reason) {
        Quote quote = baseMapper.selectById(quoteId);
        if (quote != null) {
            quote.setQuoteStatus("rejected");
            quote.setBuyerResponse("rejected");
            quote.setResponseTime(new Date());
            quote.setRemark(reason);
            quote.setUpdateTime(new Date());
            baseMapper.updateById(quote);
        }
    }

    @Override
    public Quote getQuoteByInquiryAndSeller(Long inquiryId, Long sellerId) {
        LambdaQueryWrapper<Quote> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Quote::getInquiryId, inquiryId);
        wrapper.eq(Quote::getSellerId, sellerId);
        wrapper.eq(Quote::getDelFlag, 0);
        return baseMapper.selectOne(wrapper);
    }
}