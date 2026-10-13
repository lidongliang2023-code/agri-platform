package com.agri.trade.service.impl;

import com.agri.trade.entity.Inquiry;
import com.agri.trade.entity.Quote;
import com.agri.trade.entity.Demand;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.OrderItem;
import com.agri.trade.mapper.InquiryMapper;
import com.agri.trade.mapper.QuoteMapper;
import com.agri.trade.mapper.DemandMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.OrderItemMapper;
import com.agri.trade.service.IInquiryService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InquiryServiceImpl extends ServiceImpl<InquiryMapper, Inquiry> implements IInquiryService {

    private final DemandMapper demandMapper;
    private final TradeProductMapper productMapper;
    private final QuoteMapper quoteMapper;
    private final TradeOrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;

    @Override
    public Inquiry createInquiry(Long demandId, Long productId, java.util.Collection<Long> buyerScopeMerchantIds) {
        Demand demand = demandMapper.selectById(demandId);
        TradeProduct product = productMapper.selectById(productId);

        if (demand == null || product == null) {
            return null;
        }
        // 只能对**自己的**采购需求发起询价：询价单的采购方是从需求带过来的，
        // 不校验的话，任何人都能替别人去问价（供应商那边看到的是那家采购方在问）。
        if (buyerScopeMerchantIds == null || demand.getBuyerId() == null
                || !buyerScopeMerchantIds.contains(demand.getBuyerId())) {
            return null;
        }

        return createInquiryFromDemand(demand, productId);
    }

    @Override
    public Inquiry createInquiryFromDemand(Demand demand, Long productId) {
        TradeProduct product = productMapper.selectById(productId);
        if (product == null) {
            return null;
        }

        Inquiry inquiry = new Inquiry();
        inquiry.setInquiryNo("IN" + System.currentTimeMillis());
        inquiry.setDemandId(demand.getId());
        inquiry.setDemandNo(demand.getDemandNo());
        inquiry.setProductId(product.getId());
        inquiry.setProductName(product.getProductName());
        inquiry.setBuyerId(demand.getBuyerId());
        inquiry.setBuyerName(demand.getBuyerName());
        inquiry.setSellerId(product.getSellerId());
        inquiry.setSellerName(product.getSellerName());
        inquiry.setCategoryId(demand.getCategoryId());
        inquiry.setCategoryName(demand.getCategoryName());
        inquiry.setVariety(demand.getVariety() != null ? demand.getVariety() : product.getVariety());
        inquiry.setQuantity(demand.getQuantity());
        inquiry.setUnit(demand.getUnit());
        inquiry.setPriceMin(demand.getPriceMin());
        inquiry.setPriceMax(demand.getPriceMax());
        inquiry.setDeliveryProvince(demand.getDeliveryProvince());
        inquiry.setDeliveryCity(demand.getDeliveryCity());
        inquiry.setDeliveryAddress(demand.getDeliveryAddress());
        inquiry.setDeliveryDeadline(demand.getDeliveryDeadline());
        inquiry.setQualityRequirement(demand.getQualityRequirement());
        inquiry.setCertificationRequire(demand.getCertificationRequire());
        inquiry.setSampleRequire(demand.getSampleRequire());
        inquiry.setPackagingRequire(demand.getPackagingRequire());
        inquiry.setInquiryStatus("pending_reply");

        Date deadline = new Date();
        deadline.setTime(deadline.getTime() + 3 * 24 * 60 * 60 * 1000L);
        inquiry.setReplyDeadline(deadline);
        inquiry.setReplyCount(0);
        inquiry.setDelFlag(0);
        inquiry.setCreateTime(new Date());
        inquiry.setUpdateTime(new Date());

        baseMapper.insert(inquiry);
        return inquiry;
    }

    @Override
    @Transactional
    public List<Inquiry> batchCreateInquiries(Long demandId, List<Long> productIds, Long buyerId) {
        Demand demand = demandMapper.selectById(demandId);
        if (demand == null) {
            return new ArrayList<>();
        }

        List<Inquiry> inquiries = new ArrayList<>();
        for (Long productId : productIds) {
            Inquiry inquiry = createInquiryFromDemand(demand, productId);
            if (inquiry != null) {
                inquiries.add(inquiry);
            }
        }
        return inquiries;
    }

    @Override
    public List<Inquiry> getInquiriesByBuyer(Long buyerId) {
        LambdaQueryWrapper<Inquiry> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Inquiry::getBuyerId, buyerId);
        wrapper.eq(Inquiry::getDelFlag, 0);
        wrapper.orderByDesc(Inquiry::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<Inquiry> getInquiriesByScope(java.util.Collection<Long> merchantIds) {
        if (merchantIds == null || merchantIds.isEmpty()) {
            // 没有绑定主体就没有范围 —— 返回空集，而不是"全平台询价"
            return new ArrayList<>();
        }
        LambdaQueryWrapper<Inquiry> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(Inquiry::getBuyerId, merchantIds);
        wrapper.eq(Inquiry::getDelFlag, 0);
        wrapper.orderByDesc(Inquiry::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<Inquiry> getReceivedInquiriesByScope(java.util.Collection<Long> merchantIds) {
        if (merchantIds == null || merchantIds.isEmpty()) {
            return new ArrayList<>();
        }
        LambdaQueryWrapper<Inquiry> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(Inquiry::getSellerId, merchantIds);
        wrapper.eq(Inquiry::getDelFlag, 0);
        wrapper.orderByDesc(Inquiry::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<Inquiry> getInquiriesBySeller(Long sellerId) {
        LambdaQueryWrapper<Inquiry> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Inquiry::getSellerId, sellerId);
        wrapper.eq(Inquiry::getDelFlag, 0);
        wrapper.orderByDesc(Inquiry::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<Quote> getQuotesByInquiry(Long inquiryId) {
        LambdaQueryWrapper<Quote> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Quote::getInquiryId, inquiryId);
        wrapper.eq(Quote::getDelFlag, 0);
        wrapper.orderByDesc(Quote::getCreateTime);
        return quoteMapper.selectList(wrapper);
    }

    @Override
    public void updateInquiryStatus(Long inquiryId, String status) {
        Inquiry inquiry = baseMapper.selectById(inquiryId);
        if (inquiry != null) {
            inquiry.setInquiryStatus(status);
            inquiry.setUpdateTime(new Date());
            baseMapper.updateById(inquiry);
        }
    }

    @Override
    @Transactional
    public void convertToOrder(Long inquiryId, Long quoteId) {
        Inquiry inquiry = baseMapper.selectById(inquiryId);
        Quote quote = quoteMapper.selectById(quoteId);

        if (inquiry == null || quote == null) {
            return;
        }

        // 幂等：同一份报价只生成一张订单。
        // 这条路径原先没有任何幂等保护 —— 每调用一次就 insert 一张新订单，
        // 而它对上层是"受理报价"的副产物，重复点一次就多一张单（且两张单互不相关）。
        if (quote.getOrderId() != null) {
            return;
        }

        TradeOrder order = new TradeOrder();
        order.setOrderNo("SO" + System.currentTimeMillis());
        order.setDemandId(inquiry.getDemandId());
        order.setBuyerId(inquiry.getBuyerId());
        order.setBuyerName(inquiry.getBuyerName());
        order.setSellerId(inquiry.getSellerId());
        order.setSellerName(inquiry.getSellerName());
        order.setCategoryId(inquiry.getCategoryId());
        order.setCategoryName(inquiry.getCategoryName());
        // 金额一律按 0 兜底：运费/优惠在库里都允许为 NULL，直接参与运算会空指针
        // （实测：报价 7401 的 discount_amount 为空，受理时报
        //  NullPointerException: Cannot read field "intCompact" because "subtrahend" is null，
        //  表现是"受理报价"接口 500，而报价状态已经被改成了 accepted —— 半截成功）。
        BigDecimal goods = quote.getTotalAmount() == null ? BigDecimal.ZERO : quote.getTotalAmount();
        BigDecimal freight = quote.getFreightAmount() == null ? BigDecimal.ZERO : quote.getFreightAmount();
        BigDecimal discount = quote.getDiscountAmount() == null ? BigDecimal.ZERO : quote.getDiscountAmount();
        order.setGoodsAmount(goods);
        order.setFreightAmount(freight);
        order.setDiscountAmount(discount);
        order.setTotalAmount(goods.add(freight).subtract(discount));
        order.setDeliveryProvince(inquiry.getDeliveryProvince());
        order.setDeliveryCity(inquiry.getDeliveryCity());
        order.setDeliveryAddress(inquiry.getDeliveryAddress());
        order.setDeliveryDeadline(quote.getDeliveryTime());
        // 取值必须在订单状态词表内：原先写的是 pending_pay —— 那个值前端不认识，
        // 页面上会直接显示英文原文，而且它不等同于任何已知状态。用 pending_confirm。
        order.setOrderStatus("pending_confirm");
        order.setPaymentStatus("unpaid");
        // 订单来源：与"接受报价"那条路（QuoteServiceImpl）同一口径。
        // 这里原先没写 source —— 订单落库后来源为空，按来源做的统计会把这一类整批漏掉。
        order.setSource("quote");
        order.setDelFlag(0);
        order.setCreateTime(new Date());
        order.setUpdateTime(new Date());

        orderMapper.insert(order);

        // 订单明细：与"接受报价"那条路保持一致。
        // 这里原先一行明细都不落 —— 从询价转出来的订单，详情页的"商品明细"永远是空的
        // （同一个订单表，两条生成路径一个写明细一个不写，页面表现就不一样）。
        OrderItem item = new OrderItem();
        item.setOrderId(order.getId());
        item.setProductId(quote.getProductId());
        item.setProductName(quote.getProductName());
        item.setCategoryId(order.getCategoryId());
        item.setCategoryName(order.getCategoryName());
        item.setUnit(quote.getUnit());
        item.setQuantity(quote.getQuantity());
        item.setUnitPrice(quote.getUnitPrice());
        // 实体里的金额字段叫 totalPrice（表里另有 amount 列，实体没映射 —— 写 amount
        // 会入库成功但接口读不到，页面上金额一列永远是空的）
        item.setTotalPrice(quote.getQuoteAmount() != null ? quote.getQuoteAmount() : order.getGoodsAmount());
        item.setDelFlag(0);
        item.setCreateTime(new Date());
        orderItemMapper.insert(item);

        inquiry.setOrderId(order.getId());
        inquiry.setInquiryStatus("converted");
        inquiry.setConvertTime(new Date());
        inquiry.setUpdateTime(new Date());
        baseMapper.updateById(inquiry);

        quote.setOrderId(order.getId());
        quote.setQuoteStatus("accepted");
        quote.setBuyerResponse("accepted");
        quote.setResponseTime(new Date());
        quote.setUpdateTime(new Date());
        quoteMapper.updateById(quote);
    }
}
