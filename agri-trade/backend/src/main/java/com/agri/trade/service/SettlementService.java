package com.agri.trade.service;

import com.agri.trade.entity.Settlement;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.SettlementMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 结算与分账（运营端）。
 *
 * <p><b>本轮定下的口径</b>（三件事此前没有定论，现在写死在这里）：</p>
 * <ol>
 *   <li><b>结算时点</b>：订单**确认收货之后**（order_status ∈ received / completed）
 *       且已付款。平台主打"交易资金托管"，钱应当在买家验收之后才放给卖家 ——
 *       按"已付款"就结算等于把托管做成了过账。</li>
 *   <li><b>平台服务费</b>：按**货款**计（不含运费），费率取配置项
 *       {@code agri.trade.settlement.platform-fee-rate}（默认 0.5%）。
 *       卖家应收 = 订单总额 − 平台服务费（运费本就该给承运方，不进平台收入）。</li>
 *   <li><b>与订单状态的耦合拆开</b>：订单状态推进到 completed 时**不再**顺手把
 *       settle_status 置为 settled。做完这一步，运营端才有"待结算"可处理 ——
 *       原先"完成即已结算"，待结算永远为空，结算页无事可做。</li>
 * </ol>
 *
 * <p>结算是**显式动作**，不做定时自动打款：涉及钱的动作不该在没人看着的时候自己跑。
 * （core-platform 侧另有一套平台内部交易面，那里的 SettlementJob 走的是它自己的
 * trade_order 表，与本模块的订单不是同一套数据。）</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SettlementService {

    /** 可结算的订单状态：确认收货之后。 */
    private static final Set<String> SETTLEABLE_ORDER_STATUS = Set.of("received", "completed");

    private final SettlementMapper settlementMapper;
    private final TradeOrderMapper orderMapper;

    @Value("${agri.trade.settlement.platform-fee-rate:0.005}")
    private BigDecimal platformFeeRate;

    /**
     * 待结算订单（分页）。
     *
     * @return 每行 = 订单 + 按当前费率**预估**的服务费与卖家应收。
     *         这里只是预估，真正落库的金额在结算那一刻由服务端重算并留痕。
     */
    public IPage<Map<String, Object>> pendingPage(int pageNum, int pageSize) {
        Set<Long> settledOrderIds = settledOrderIds();
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getDelFlag, 0)
                .in(TradeOrder::getOrderStatus, SETTLEABLE_ORDER_STATUS)
                .eq(TradeOrder::getPaymentStatus, "paid");
        if (!settledOrderIds.isEmpty()) {
            wrapper.notIn(TradeOrder::getId, settledOrderIds);
        }
        wrapper.orderByAsc(TradeOrder::getCreateTime);

        Page<TradeOrder> page = orderMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        List<Map<String, Object>> rows = page.getRecords().stream().map(this::toPendingView).toList();
        Page<Map<String, Object>> result = new Page<>(page.getCurrent(), page.getSize(), page.getTotal());
        result.setRecords(rows);
        return result;
    }

    /** 已结算记录（分页）。 */
    public IPage<Settlement> settledPage(int pageNum, int pageSize, Long sellerId) {
        LambdaQueryWrapper<Settlement> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Settlement::getDelFlag, 0);
        if (sellerId != null) {
            wrapper.eq(Settlement::getSellerId, sellerId);
        }
        wrapper.orderByDesc(Settlement::getSettleTime);
        return settlementMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
    }

    /** 大盘：待结算 / 已结算 / 平台服务费合计。 */
    public Map<String, Object> summary() {
        Set<Long> settledOrderIds = settledOrderIds();

        LambdaQueryWrapper<TradeOrder> pendingWrapper = new LambdaQueryWrapper<>();
        pendingWrapper.eq(TradeOrder::getDelFlag, 0)
                .in(TradeOrder::getOrderStatus, SETTLEABLE_ORDER_STATUS)
                .eq(TradeOrder::getPaymentStatus, "paid");
        if (!settledOrderIds.isEmpty()) {
            pendingWrapper.notIn(TradeOrder::getId, settledOrderIds);
        }
        List<TradeOrder> pendingOrders = orderMapper.selectList(pendingWrapper);

        BigDecimal pendingAmount = BigDecimal.ZERO;
        BigDecimal pendingFee = BigDecimal.ZERO;
        for (TradeOrder order : pendingOrders) {
            pendingAmount = pendingAmount.add(nullToZero(order.getTotalAmount()));
            pendingFee = pendingFee.add(platformFee(order));
        }

        List<Settlement> settled = settlementMapper.selectList(new LambdaQueryWrapper<Settlement>()
                .eq(Settlement::getDelFlag, 0));
        BigDecimal settledAmount = BigDecimal.ZERO;
        BigDecimal settledFee = BigDecimal.ZERO;
        BigDecimal settledReceivable = BigDecimal.ZERO;
        for (Settlement s : settled) {
            settledAmount = settledAmount.add(nullToZero(s.getTotalAmount()));
            settledFee = settledFee.add(nullToZero(s.getPlatformFee()));
            settledReceivable = settledReceivable.add(nullToZero(s.getSellerReceivable()));
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("platformFeeRate", platformFeeRate);
        summary.put("pendingCount", pendingOrders.size());
        summary.put("pendingAmount", pendingAmount.setScale(2, RoundingMode.HALF_UP));
        summary.put("pendingPlatformFee", pendingFee.setScale(2, RoundingMode.HALF_UP));
        summary.put("pendingSellerReceivable",
                pendingAmount.subtract(pendingFee).setScale(2, RoundingMode.HALF_UP));
        summary.put("settledCount", settled.size());
        summary.put("settledAmount", settledAmount.setScale(2, RoundingMode.HALF_UP));
        summary.put("settledPlatformFee", settledFee.setScale(2, RoundingMode.HALF_UP));
        summary.put("settledSellerReceivable", settledReceivable.setScale(2, RoundingMode.HALF_UP));
        return summary;
    }

    /**
     * 结算一笔订单。
     *
     * <p>金额全部由服务端按订单真实数据重算，不接受调用方传金额 ——
     * 否则"给卖家打多少"就成了谁调接口谁说了算。</p>
     *
     * @param settleBy 操作人（取自令牌，仅作留痕）
     * @return 落库的结算记录；不满足结算条件时返回 null（调用方据此给提示）
     */
    @Transactional
    public Settlement settle(Long orderId, String settleBy) {
        TradeOrder order = orderMapper.selectById(orderId);
        if (order == null || (order.getDelFlag() != null && order.getDelFlag() == 1)) {
            return null;
        }
        // 幂等：一笔订单只结算一次。重复结算不是"再打一次钱"这么简单，
        // 它会在账上留下两条互不相干的结算记录。
        Long exists = settlementMapper.selectCount(new LambdaQueryWrapper<Settlement>()
                .eq(Settlement::getOrderId, orderId));
        if (exists != null && exists > 0) {
            return null;
        }
        if (!SETTLEABLE_ORDER_STATUS.contains(order.getOrderStatus())) {
            return null;
        }
        if (!"paid".equals(order.getPaymentStatus())) {
            return null;
        }

        BigDecimal total = nullToZero(order.getTotalAmount());
        BigDecimal fee = platformFee(order);
        Date now = new Date();

        Settlement settlement = new Settlement();
        settlement.setSettlementNo("ST" + System.currentTimeMillis());
        settlement.setOrderId(order.getId());
        settlement.setOrderNo(order.getOrderNo());
        settlement.setBuyerId(order.getBuyerId());
        settlement.setBuyerName(order.getBuyerName());
        settlement.setSellerId(order.getSellerId());
        settlement.setSellerName(order.getSellerName());
        settlement.setGoodsAmount(nullToZero(order.getGoodsAmount()));
        settlement.setFreightAmount(nullToZero(order.getFreightAmount()));
        settlement.setTotalAmount(total);
        settlement.setPlatformFeeRate(platformFeeRate);
        settlement.setPlatformFee(fee);
        settlement.setSellerReceivable(total.subtract(fee).setScale(2, RoundingMode.HALF_UP));
        settlement.setSettleStatus("settled");
        settlement.setSettleTime(now);
        settlement.setSettleBy(settleBy);
        settlement.setDelFlag(0);
        settlement.setCreateTime(now);
        settlement.setUpdateTime(now);
        settlementMapper.insert(settlement);

        // 订单侧同步标记，让列表与状态机看到"这单已结算"
        order.setSettleStatus("settled");
        order.setSettleTime(now);
        order.setUpdateTime(now);
        orderMapper.updateById(order);

        log.info("订单结算完成：orderId={} 总额={} 平台服务费={} 卖家应收={}",
                order.getId(), total, fee, settlement.getSellerReceivable());
        return settlement;
    }

    private Set<Long> settledOrderIds() {
        return settlementMapper.selectList(new LambdaQueryWrapper<Settlement>()
                        .eq(Settlement::getDelFlag, 0)
                        .select(Settlement::getOrderId))
                .stream().map(Settlement::getOrderId).filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private BigDecimal platformFee(TradeOrder order) {
        BigDecimal goods = nullToZero(order.getGoodsAmount());
        return goods.multiply(platformFeeRate).setScale(2, RoundingMode.HALF_UP);
    }

    private Map<String, Object> toPendingView(TradeOrder order) {
        BigDecimal total = nullToZero(order.getTotalAmount());
        BigDecimal fee = platformFee(order);
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("orderId", order.getId());
        view.put("orderNo", order.getOrderNo());
        view.put("buyerId", order.getBuyerId());
        view.put("buyerName", order.getBuyerName());
        view.put("sellerId", order.getSellerId());
        view.put("sellerName", order.getSellerName());
        view.put("goodsAmount", nullToZero(order.getGoodsAmount()));
        view.put("freightAmount", nullToZero(order.getFreightAmount()));
        view.put("totalAmount", total);
        view.put("orderStatus", order.getOrderStatus());
        view.put("platformFeeRate", platformFeeRate);
        view.put("platformFee", fee);
        view.put("sellerReceivable", total.subtract(fee).setScale(2, RoundingMode.HALF_UP));
        view.put("settleTime", order.getSettleTime());
        return view;
    }

    private static BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
