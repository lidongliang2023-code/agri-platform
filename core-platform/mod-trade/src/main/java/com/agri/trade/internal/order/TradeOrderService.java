package com.agri.trade.internal.order;

import com.agri.core.infra.event.DomainEventPublisher;
import com.agri.platform.api.facade.ProductFacade;
import com.agri.trade.api.event.TradeEvents;
import com.agri.trade.internal.listing.ListingEntity;
import com.agri.trade.internal.listing.ListingMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 订单应用服务：撮合下单 → 支付（本地事务：订单状态 + 扣库存 + 事件落消息表）→ 结算。
 * 事务边界在此层（图 2：internal 层承载事务边界）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TradeOrderService {

    private static final DateTimeFormatter NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final TradeOrderMapper orderMapper;
    private final ListingMapper listingMapper;
    private final DomainEventPublisher eventPublisher;
    private final ProductFacade productFacade;

    /**
     * 撮合下单（MVP）：从供货挂牌创建订单并锁定挂牌。
     * 库存校验与扣减经商品中心 OHS（api 包）完成，在支付环节执行。
     */
    @Transactional
    public TradeOrderEntity createOrder(Long listingId, Long buyerMerchantId, BigDecimal quantity) {
        ListingEntity listing = listingMapper.selectById(listingId);
        if (listing == null || !"OPEN".equals(listing.getStatus())) {
            throw new BusinessException(ErrorCode.LISTING_CLOSED);
        }
        if (listing.getMerchantId().equals(buyerMerchantId)) {
            throw new BusinessException(ErrorCode.BIZ_ERROR, "不能与自己挂牌成交");
        }
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0
                || quantity.compareTo(listing.getQuantity()) > 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "数量必须在挂牌量范围内");
        }

        TradeOrderEntity order = new TradeOrderEntity();
        order.setOrderNo("TO" + NO_FORMAT.format(LocalDateTime.now())
                + ThreadLocalRandom.current().nextInt(1000, 9999));
        order.setListingId(listingId);
        order.setBuyerMerchantId(buyerMerchantId);
        order.setSellerMerchantId(listing.getMerchantId());
        order.setProductId(listing.getProductId());
        order.setProductName(listing.getProductName());
        order.setQuantity(quantity);
        order.setUnitPrice(listing.getPrice());
        order.setAmount(listing.getPrice().multiply(quantity));
        order.setStatus("CREATED");
        orderMapper.insert(order);

        // 锁定挂牌（MVP 全量锁定；部分成交模型后续迭代）
        listing.setStatus("MATCHED");
        listingMapper.updateById(listing);
        return order;
    }

    /**
     * 支付成功回调（生产环境由支付网关异步通知，需幂等 + 验签；此处为 MVP 直调）。
     * 本地事务：订单状态 + 库存扣减 + 事件落本地消息表，同生共死（图 5）。
     */
    @Transactional
    public void pay(Long orderId, String payNo) {
        TradeOrderEntity order = mustGet(orderId);
        if (!"CREATED".equals(order.getStatus())) {
            throw new BusinessException(ErrorCode.ORDER_NOT_PAYABLE);
        }
        // 幂等：同一支付单号直接返回成功
        if (payNo != null && payNo.equals(order.getPayNo())) {
            return;
        }
        // 跨模块同步调用走商品中心 api（同库同事务；拆分时改为远程调用 + 事务消息）
        if (!productFacade.decreaseStock(order.getProductId(), order.getQuantity())) {
            throw new BusinessException(ErrorCode.BIZ_ERROR, "库存不足");
        }
        order.setStatus("PAID");
        order.setPayNo(payNo);
        order.setPaidAt(LocalDateTime.now());
        orderMapper.updateById(order);

        eventPublisher.publish(TradeEvents.ORDER_DEAL_DONE, order.getOrderNo(),
                new TradeEvents.OrderDealDone(order.getId(), order.getOrderNo(), order.getBuyerMerchantId(),
                        order.getSellerMerchantId(), order.getProductId(), order.getProductName(),
                        order.getQuantity(), order.getAmount(), order.getMarketId(),
                        LocalDateTime.now().toString()));
    }

    /** 结算（T+1 批处理或人工触发）：PAID → SETTLED + payment.settled 事件 */
    @Transactional
    public void settle(Long orderId) {
        TradeOrderEntity order = mustGet(orderId);
        if (!"PAID".equals(order.getStatus())) {
            throw new BusinessException(ErrorCode.SETTLE_FAILED, "订单状态不可结算");
        }
        order.setStatus("SETTLED");
        order.setSettledAt(LocalDateTime.now());
        orderMapper.updateById(order);

        eventPublisher.publish(TradeEvents.PAYMENT_SETTLED, order.getOrderNo(),
                new TradeEvents.PaymentSettled(order.getId(), order.getOrderNo(), order.getAmount(),
                        order.getMarketId(), LocalDateTime.now().toString()));
    }

    @Transactional
    public void cancel(Long orderId) {
        TradeOrderEntity order = mustGet(orderId);
        if (!"CREATED".equals(order.getStatus())) {
            throw new BusinessException(ErrorCode.ORDER_NOT_PAYABLE, "仅待支付订单可取消");
        }
        order.setStatus("CANCELLED");
        orderMapper.updateById(order);

        // 释放挂牌
        if (order.getListingId() != null) {
            ListingEntity listing = listingMapper.selectById(order.getListingId());
            if (listing != null && "MATCHED".equals(listing.getStatus())) {
                listing.setStatus("OPEN");
                listingMapper.updateById(listing);
            }
        }
    }

    public PageResult<TradeOrderEntity> page(long page, long size, String status) {
        Page<TradeOrderEntity> result = orderMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<TradeOrderEntity>()
                        .eq(status != null && !status.isBlank(), TradeOrderEntity::getStatus, status)
                        .orderByDesc(TradeOrderEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    private TradeOrderEntity mustGet(Long orderId) {
        TradeOrderEntity order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new BusinessException(ErrorCode.ORDER_NOT_FOUND);
        }
        return order;
    }
}
