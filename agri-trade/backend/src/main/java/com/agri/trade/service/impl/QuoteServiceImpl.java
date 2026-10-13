package com.agri.trade.service.impl;

import com.agri.trade.entity.Quote;
import com.agri.trade.entity.Inquiry;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.OrderItem;
import com.agri.trade.mapper.QuoteMapper;
import com.agri.trade.mapper.InquiryMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.OrderItemMapper;
import com.agri.trade.service.IQuoteService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
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
    private final TradeOrderMapper tradeOrderMapper;
    private final OrderItemMapper orderItemMapper;

    @Override
    @Transactional
    public TradeOrder convertToOrder(Long quoteId) {
        Quote quote = baseMapper.selectById(quoteId);
        if (quote == null) {
            return null;
        }
        // 已拒绝的报价不能转订单：那不是"还没定的价"，而是"已经谈崩的价"。
        if ("rejected".equals(quote.getQuoteStatus())) {
            return null;
        }
        // 幂等：同一份报价只生成一张订单。没有这道保护，重复点一下"生成订单"
        // 就会多出一张重复订单，而订单一旦生成就很难悄悄撤掉。
        if (quote.getOrderId() != null) {
            TradeOrder exist = tradeOrderMapper.selectById(quote.getOrderId());
            if (exist != null) {
                return exist;
            }
        }

        Inquiry inquiry = quote.getInquiryId() == null ? null : inquiryMapper.selectById(quote.getInquiryId());
        TradeProduct product = quote.getProductId() == null ? null : productMapper.selectById(quote.getProductId());

        BigDecimal goods = quote.getQuoteAmount() != null ? quote.getQuoteAmount()
                : (quote.getTotalAmount() != null ? quote.getTotalAmount() : BigDecimal.ZERO);
        BigDecimal freight = quote.getFreightAmount() == null ? BigDecimal.ZERO : quote.getFreightAmount();
        BigDecimal discount = quote.getDiscountAmount() == null ? BigDecimal.ZERO : quote.getDiscountAmount();

        Date now = new Date();
        TradeOrder order = new TradeOrder();
        order.setOrderNo("SO" + System.currentTimeMillis());
        order.setDemandId(inquiry != null ? inquiry.getDemandId() : null);
        order.setBuyerId(quote.getBuyerId());
        order.setBuyerName(quote.getBuyerName());
        order.setSellerId(quote.getSellerId());
        order.setSellerName(quote.getSellerName());
        if (product != null) {
            order.setCategoryId(product.getCategoryId());
            order.setCategoryName(product.getCategoryName());
        }
        order.setGoodsAmount(goods);
        order.setFreightAmount(freight);
        order.setDiscountAmount(discount);
        // 总额由服务端按同一套口径算：报价单上的数字只作参考，
        // 落库金额不能是"谁调接口谁说了算"。
        order.setTotalAmount(goods.add(freight).subtract(discount));
        order.setPaidAmount(BigDecimal.ZERO);
        order.setCurrency("CNY");
        order.setPaymentStatus("unpaid");
        order.setOrderStatus("pending_confirm");
        order.setDeliveryAddress(quote.getDeliveryAddress());
        order.setDeliveryDeadline(quote.getDeliveryDeadline());
        order.setSource("quote");
        order.setDelFlag(0);
        order.setCreateTime(now);
        order.setUpdateTime(now);
        tradeOrderMapper.insert(order);

        // 订单明细：一份报价先落一行，确认订单时买家还能改数量（改的是订单，不是报价）
        OrderItem item = new OrderItem();
        item.setOrderId(order.getId());
        item.setProductId(quote.getProductId());
        item.setProductName(quote.getProductName());
        item.setCategoryId(order.getCategoryId());
        item.setCategoryName(order.getCategoryName());
        item.setUnit(quote.getUnit());
        item.setQuantity(quote.getQuantity());
        item.setUnitPrice(quote.getUnitPrice());
        // 实体里的金额字段叫 totalPrice（不是 amount）—— 表里有 amount 列但实体没映射它，
        // 写 amount 会成功入库、接口却读不到，页面上"金额"一列永远是空的。
        item.setTotalPrice(quote.getQuoteAmount());
        item.setDelFlag(0);
        item.setCreateTime(now);
        orderItemMapper.insert(item);

        // 回写报价：接受 + 关联订单
        quote.setQuoteStatus("accepted");
        quote.setBuyerResponse("accepted");
        if (quote.getResponseTime() == null) {
            quote.setResponseTime(now);
        }
        quote.setOrderId(order.getId());
        quote.setUpdateTime(now);
        baseMapper.updateById(quote);

        return order;
    }

    @Override
    public IPage<Quote> getQuotePage(int pageNum, int pageSize, String quoteStatus, Long sellerId, Long buyerId) {
        LambdaQueryWrapper<Quote> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Quote::getDelFlag, 0);
        if (quoteStatus != null && !quoteStatus.isEmpty()) {
            wrapper.eq(Quote::getQuoteStatus, quoteStatus);
        }
        if (sellerId != null) {
            wrapper.eq(Quote::getSellerId, sellerId);
        }
        if (buyerId != null) {
            wrapper.eq(Quote::getBuyerId, buyerId);
        }
        wrapper.orderByDesc(Quote::getCreateTime);
        return page(new Page<>(pageNum, pageSize), wrapper);
    }

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
