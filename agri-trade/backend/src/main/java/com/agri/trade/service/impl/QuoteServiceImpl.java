package com.agri.trade.service.impl;

import com.agri.trade.entity.Quote;
import com.agri.trade.entity.Inquiry;
import com.agri.trade.entity.Demand;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.OrderItem;
import com.agri.trade.entity.Contract;
import com.agri.trade.mapper.ContractMapper;
import com.agri.trade.mapper.DemandMapper;
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
import java.math.RoundingMode;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class QuoteServiceImpl extends ServiceImpl<QuoteMapper, Quote> implements IQuoteService {

    /** 报价默认有效期（天）。与"卖家回应询价"那条路径保持同一个默认值。 */
    private static final int DEFAULT_VALID_DAYS = 7;

    private final InquiryMapper inquiryMapper;
    private final DemandMapper demandMapper;
    private final TradeProductMapper productMapper;
    private final TradeOrderMapper tradeOrderMapper;
    private final OrderItemMapper orderItemMapper;
    private final ContractMapper contractMapper;

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
        order.setProductName(quote.getProductName());
        order.setTotalQuantity(quote.getQuantity());
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

        completeDemand(inquiry == null ? null : inquiry.getDemandId());
        ensureContract(order);
        return order;
    }

    @Override
    public IPage<Quote> getQuotePage(int pageNum, int pageSize, String quoteStatus, Long sellerId, Long buyerId) {
        return getQuotePage(pageNum, pageSize, quoteStatus, sellerId, buyerId, null);
    }

    @Override
    public IPage<Quote> getQuotePage(int pageNum, int pageSize, String quoteStatus,
                                     Long sellerId, Long buyerId, java.util.Collection<Long> scopeMerchantIds) {
        return getQuotePage(pageNum, pageSize, quoteStatus, sellerId, buyerId, scopeMerchantIds, null, null);
    }

    @Override
    public IPage<Quote> getQuotePage(int pageNum, int pageSize, String quoteStatus,
                                     Long sellerId, Long buyerId, java.util.Collection<Long> scopeMerchantIds,
                                     String quoteNo, String productName) {
        LambdaQueryWrapper<Quote> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Quote::getDelFlag, 0);
        // 数据范围：只返回"我参与的报价"（我是买方或卖方）。原先不给范围就返回全平台报价 ——
        // 报价里有单价、数量与供应商，是正在谈的生意，与订单/合同是同一类问题。
        if (scopeMerchantIds == null || scopeMerchantIds.isEmpty()) {
            wrapper.eq(Quote::getId, -1L);
        } else {
            wrapper.and(w -> w.in(Quote::getBuyerId, scopeMerchantIds)
                    .or().in(Quote::getSellerId, scopeMerchantIds));
        }
        if (quoteStatus != null && !quoteStatus.isEmpty()) {
            wrapper.eq(Quote::getQuoteStatus, quoteStatus);
        }
        if (sellerId != null) {
            wrapper.eq(Quote::getSellerId, sellerId);
        }
        if (buyerId != null) {
            wrapper.eq(Quote::getBuyerId, buyerId);
        }
        if (quoteNo != null && !quoteNo.isBlank()) {
            wrapper.like(Quote::getQuoteNo, quoteNo.trim());
        }
        if (productName != null && !productName.isBlank()) {
            wrapper.like(Quote::getProductName, productName.trim());
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
        quote.setQuoteAmount(quote.getTotalAmount());
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
        inquiry.setInquiryStatus("quoted");
        inquiry.setUpdateTime(new Date());
        inquiryMapper.updateById(inquiry);

        Demand demand = inquiry.getDemandId() == null ? null : demandMapper.selectById(inquiry.getDemandId());
        if (demand != null) {
            demand.setResponseCount(demand.getResponseCount() == null ? 1 : demand.getResponseCount() + 1);
            demand.setDemandStatus("quoted");
            demand.setUpdateTime(new Date());
            demandMapper.updateById(demand);
        }
        return quote;
    }

    @Override
    @Transactional
    public Quote createQuoteFromForm(Quote draft, Long sellerId, String sellerName, Integer validDays) {
        Quote quote = new Quote();
        quote.setQuoteNo("QT" + System.currentTimeMillis());
        quote.setProductId(draft.getProductId());
        quote.setProductName(draft.getProductName());
        quote.setBuyerId(draft.getBuyerId());
        quote.setBuyerName(draft.getBuyerName());
        quote.setSellerId(sellerId);
        quote.setSellerName(sellerName);
        quote.setUnitPrice(draft.getUnitPrice());
        quote.setQuantity(draft.getQuantity());
        quote.setUnit(draft.getUnit());
        // 总价由服务端算（单价 × 数量）。表单里那个数字只作参考 ——
        // 让请求体直接决定金额，等于把报价单的钱数交给浏览器。
        quote.setTotalAmount(amount(draft.getUnitPrice(), draft.getQuantity()));
        quote.setQuoteAmount(quote.getTotalAmount());
        quote.setFreightAmount(BigDecimal.ZERO);
        quote.setDiscountAmount(BigDecimal.ZERO);
        quote.setDeliveryTime(draft.getDeliveryTime());
        quote.setDeliveryAddress(draft.getDeliveryAddress());
        quote.setQualityDescription(draft.getQualityDescription());
        quote.setPayment_terms("prepayment");
        quote.setValidUntil(validUntil(validDays));
        quote.setQuoteStatus("pending");
        quote.setDelFlag(0);
        Date now = new Date();
        quote.setCreateTime(now);
        quote.setUpdateTime(now);
        quote.setRemark(draft.getRemark());
        baseMapper.insert(quote);
        return quote;
    }

    @Override
    @Transactional
    public boolean updateQuoteFromForm(Long id, Quote patch, Integer validDays) {
        Quote exist = baseMapper.selectById(id);
        if (exist == null || (exist.getDelFlag() != null && exist.getDelFlag() == 1)) {
            return false;
        }
        // 已生成订单或已定稿的报价不能改：改了单价就是把已成单的金额改掉。
        if (exist.getOrderId() != null || !"pending".equals(exist.getQuoteStatus())) {
            return false;
        }
        if (patch.getProductName() != null) {
            exist.setProductName(patch.getProductName());
        }
        if (patch.getUnitPrice() != null) {
            exist.setUnitPrice(patch.getUnitPrice());
        }
        if (patch.getQuantity() != null) {
            exist.setQuantity(patch.getQuantity());
        }
        if (patch.getUnit() != null) {
            exist.setUnit(patch.getUnit());
        }
        if (patch.getDeliveryTime() != null) {
            exist.setDeliveryTime(patch.getDeliveryTime());
        }
        if (patch.getDeliveryAddress() != null) {
            exist.setDeliveryAddress(patch.getDeliveryAddress());
        }
        if (patch.getQualityDescription() != null) {
            exist.setQualityDescription(patch.getQualityDescription());
        }
        if (patch.getRemark() != null) {
            exist.setRemark(patch.getRemark());
        }
        // 金额跟着改后的单价/数量重算，不允许出现"改了数量、总价还是旧的"
        exist.setTotalAmount(amount(exist.getUnitPrice(), exist.getQuantity()));
        exist.setQuoteAmount(exist.getTotalAmount());
        if (validDays != null) {
            exist.setValidUntil(validUntil(validDays));
        }
        exist.setUpdateTime(new Date());
        return baseMapper.updateById(exist) > 0;
    }

    @Override
    @Transactional
    public boolean deleteQuote(Long id) {
        Quote exist = baseMapper.selectById(id);
        if (exist == null) {
            return false;
        }
        // 已生成订单的报价不能删：删了订单就找不到来源了。
        if (exist.getOrderId() != null) {
            return false;
        }
        // 必须用 deleteById：MyBatis-Plus 配了全局逻辑删除字段（del_flag），
        // updateById 会**跳过** SET 里的逻辑删除列。写成 setDelFlag(1)+updateById 的效果是
        // 接口返回成功、update_time 也变了，但 del_flag 一直是 0 —— 记录根本没删掉，列表里还在。
        // （实测：接口 data=true，读库 del_flag 仍是 0。）
        return baseMapper.deleteById(id) > 0;
    }

    private static BigDecimal amount(BigDecimal unitPrice, BigDecimal quantity) {
        if (unitPrice == null || quantity == null) {
            return BigDecimal.ZERO;
        }
        return unitPrice.multiply(quantity).setScale(2, RoundingMode.HALF_UP);
    }

    /** 有效期：按天算出来一个绝对时间点存库（表里只有 valid_until 这一列，没有天数列）。 */
    private static Date validUntil(Integer validDays) {
        int days = (validDays == null || validDays < 1) ? DEFAULT_VALID_DAYS : Math.min(validDays, 365);
        return new Date(System.currentTimeMillis() + days * 24L * 60 * 60 * 1000);
    }

    /** 报价成单后，需求从"报价中"推进到"已成交"。 */
    private void completeDemand(Long demandId) {
        if (demandId == null) return;
        Demand demand = demandMapper.selectById(demandId);
        if (demand != null) {
            demand.setDemandStatus("completed");
            demand.setUpdateTime(new Date());
            demandMapper.updateById(demand);
        }
    }

    /**
     * 成单即生成待签合同。合同以订单为唯一事实来源，双方随后在各自会员中心签署；
     * 同一订单已有合同时直接复用，避免重复点击生成多份合同。
     */
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
