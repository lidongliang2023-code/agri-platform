package com.agri.trade.service.impl;

import com.agri.trade.entity.Inquiry;
import com.agri.trade.entity.Quote;
import com.agri.trade.entity.Demand;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.OrderItem;
import com.agri.trade.entity.Contract;
import com.agri.trade.mapper.ContractMapper;
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
    private final ContractMapper contractMapper;

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
        if (hasInquiry(demand.getId(), productId)) {
            // 重复点"发起询价"不该堆出第二张一模一样的待报价单。
            return null;
        }

        return createInquiryFromDemand(demand, productId);
    }

    /**
     * 由已通过归属校验的采购需求生成询价单。
     *
     * <p>刻意**不放进接口**：这个方法没有归属校验（拿到 Demand 就发问），
     * 暴露出去等于给后面的人留一条"绕过 createInquiry 那道闸门"的近路。
     * 调用方必须先确认这张需求属于当前主体。</p>
     */
    private Inquiry createInquiryFromDemand(Demand demand, Long productId) {
        TradeProduct product = productMapper.selectById(productId);
        if (product == null) {
            return null;
        }

        Inquiry inquiry = new Inquiry();
        inquiry.setInquiryNo(nextInquiryNo());
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
    public List<Inquiry> batchCreateInquiries(Long demandId, List<Long> productIds,
                                              java.util.Collection<Long> buyerScopeMerchantIds) {
        Demand demand = demandMapper.selectById(demandId);
        if (demand == null) {
            return new ArrayList<>();
        }
        // 与单条发起同一道闸门：询价单的采购方是从需求带过来的，
        // 不校验需求归属，任何人都能对别人的需求批量发问（供应商看到的是那家在问）。
        if (buyerScopeMerchantIds == null || demand.getBuyerId() == null
                || !buyerScopeMerchantIds.contains(demand.getBuyerId())) {
            return new ArrayList<>();
        }

        List<Inquiry> inquiries = new ArrayList<>();
        for (Long productId : productIds) {
            // 同一张需求对同一个货源只问一次：以前重复点"批量询价"会堆出好几条一模一样的
            // 待报价单，供应商那边看到的是同一家问了三遍。
            if (hasInquiry(demandId, productId)) {
                continue;
            }
            Inquiry inquiry = createInquiryFromDemand(demand, productId);
            if (inquiry != null) {
                inquiries.add(inquiry);
            }
        }
        return inquiries;
    }

    /** 这张需求是否已经向该货源发过询价（未删除的）。 */
    private boolean hasInquiry(Long demandId, Long productId) {
        Long existing = baseMapper.selectCount(new LambdaQueryWrapper<Inquiry>()
                .eq(Inquiry::getDemandId, demandId)
                .eq(Inquiry::getProductId, productId)
                .eq(Inquiry::getDelFlag, 0));
        return existing != null && existing > 0;
    }

    /**
     * 询价单号。
     *
     * <p>以前是 {@code "IN" + currentTimeMillis()}：批量发起时同毫秒会撞 {@code uk_inquiry_no}
     * 唯一索引，第二条直接抛异常、整批回滚，页面上只剩一句"发起询价失败"。
     * 后面补 6 位随机段，同毫秒也不同号。</p>
     */
    private static String nextInquiryNo() {
        return "IN" + System.currentTimeMillis()
                + java.util.UUID.randomUUID().toString().substring(0, 6).toUpperCase();
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
    public List<Quote> getQuotesByInquiry(Long inquiryId) {
        LambdaQueryWrapper<Quote> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Quote::getInquiryId, inquiryId);
        wrapper.eq(Quote::getDelFlag, 0);
        wrapper.orderByDesc(Quote::getCreateTime);
        return quoteMapper.selectList(wrapper);
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
        order.setProductName(quote.getProductName());
        order.setTotalQuantity(quote.getQuantity());
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

        Demand demand = inquiry.getDemandId() == null ? null : demandMapper.selectById(inquiry.getDemandId());
        if (demand != null) {
            demand.setDemandStatus("completed");
            demand.setUpdateTime(new Date());
            demandMapper.updateById(demand);
        }
        ensureContract(order);
    }

    /** 报价成单后生成待签合同；同一订单已有合同时复用。 */
    private void ensureContract(TradeOrder order) {
        Contract existing = contractMapper.selectOne(new LambdaQueryWrapper<Contract>()
                .eq(Contract::getOrderId, order.getId())
                .eq(Contract::getDelFlag, 0)
                .last("LIMIT 1"));
        if (existing != null) return;

        Date now = new Date();
        Contract contract = new Contract();
        contract.setContractNo("CO" + System.currentTimeMillis());
        contract.setContractName((order.getProductName() == null ? "农产品" : order.getProductName()) + "采购合同");
        contract.setContractType("sale");
        contract.setOrderId(order.getId());
        contract.setOrderNo(order.getOrderNo());
        contract.setBuyerId(order.getBuyerId());
        contract.setBuyerName(order.getBuyerName());
        contract.setSellerId(order.getSellerId());
        contract.setSellerName(order.getSellerName());
        contract.setContractAmount(order.getTotalAmount());
        contract.setDeliveryDate(order.getDeliveryDeadline());
        contract.setDeliveryAddress(order.getDeliveryAddress());
        contract.setContractContent("由询价报价成交自动生成。订单 " + order.getOrderNo()
                + "，成交金额 " + order.getTotalAmount() + " 元。");
        contract.setContractStatus("draft");
        contract.setBuyerSignStatus("pending");
        contract.setSellerSignStatus("pending");
        contract.setArchiveStatus("pending");
        contract.setChainStatus("pending");
        contract.setDelFlag(0);
        contract.setCreateTime(now);
        contract.setUpdateTime(now);
        contractMapper.insert(contract);
    }
}
