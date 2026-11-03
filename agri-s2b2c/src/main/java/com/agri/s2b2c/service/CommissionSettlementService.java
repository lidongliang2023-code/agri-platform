package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Commission;
import com.agri.s2b2c.entity.CommissionSettlement;
import com.agri.s2b2c.mapper.CommissionMapper;
import com.agri.s2b2c.mapper.CommissionSettlementMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 佣金批量结算。
 *
 * <p>按「渠道 + 账期」把<b>可结算</b>的 PENDING 佣金结清，并写一条结算批次，佣金行记录批次号 ——
 * 之后要追溯"哪一笔钱是哪次结算的"只要看批次，不用猜时间范围。</p>
 *
 * <p>"可结算"不由本类判断，一律问 {@link CommissionSettlementRule}：
 * 结算与页面提示必须用同一条口径，否则会出现"页面说这 3 笔能结、后端却没结"。</p>
 */
@Service
@RequiredArgsConstructor
public class CommissionSettlementService {

    private static final DateTimeFormatter NO_FMT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final CommissionMapper commissionMapper;
    private final CommissionSettlementMapper settlementMapper;
    private final CommissionSettlementRule settlementRule;

    /** 这一轮没被结算的佣金，以及为什么没被结算。 */
    public record Blocked(Long commissionId, Long orderId, String orderStatus, String reason, BigDecimal amount) {
    }

    /**
     * 结算结果：批次号、笔数、金额，外加<b>被挡住的笔数与原因</b>。
     *
     * <p>blocked 不是可选装饰：只回 {@code count=0} 的话，操作员看到的是"没有待结算佣金"，
     * 而事实是"有 5 笔待结算，但订单都没完成" —— 这两个结论会引导出完全不同的动作。</p>
     */
    public record SettlementResult(String batchNo, int count, BigDecimal amount,
                                  int blockedCount, BigDecimal blockedAmount, List<Blocked> blocked) {

        /** 没有可结算记录时的空结果（仍然带着被挡清单）。 */
        public static SettlementResult none(List<Blocked> blocked) {
            BigDecimal sum = blocked.stream().map(Blocked::amount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            return new SettlementResult(null, 0, BigDecimal.ZERO, blocked.size(), sum, blocked);
        }
    }

    @Transactional
    public SettlementResult settle(Long channelId, LocalDate periodStart, LocalDate periodEnd, String operator) {
        LambdaQueryWrapper<Commission> wrapper = new LambdaQueryWrapper<Commission>()
                .eq(Commission::getStatus, "PENDING")
                .eq(channelId != null, Commission::getChannelId, channelId)
                .ge(periodStart != null, Commission::getCreateTime,
                        periodStart == null ? null : periodStart.atStartOfDay())
                .lt(periodEnd != null, Commission::getCreateTime,
                        periodEnd == null ? null : periodEnd.plusDays(1).atStartOfDay());
        List<Commission> pending = commissionMapper.selectList(wrapper);
        if (pending.isEmpty()) {
            return new SettlementResult(null, 0, BigDecimal.ZERO, 0, BigDecimal.ZERO, List.of());
        }
        Map<Long, Commission> byId = pending.stream()
                .collect(Collectors.toMap(Commission::getId, Function.identity(), (a, b) -> a));
        List<Commission> settleable = new ArrayList<>();
        List<Blocked> blocked = new ArrayList<>();
        for (CommissionSettlementRule.Verdict verdict : settlementRule.evaluate(pending)) {
            Commission commission = byId.get(verdict.commissionId());
            if (commission == null) {
                continue;
            }
            if (verdict.settleable()) {
                settleable.add(commission);
            } else {
                blocked.add(new Blocked(commission.getId(), verdict.orderId(), verdict.orderStatus(),
                        verdict.reason(), commission.getAmount()));
            }
        }
        if (settleable.isEmpty()) {
            return SettlementResult.none(blocked);
        }
        String batchNo = "CS" + NO_FMT.format(LocalDateTime.now())
                + ThreadLocalRandom.current().nextInt(100, 999);
        BigDecimal amount = BigDecimal.ZERO;
        LocalDateTime now = LocalDateTime.now();
        for (Commission commission : settleable) {
            commission.setStatus("SETTLED");
            commission.setSettleTime(now);
            commission.setSettleBatchNo(batchNo);
            commissionMapper.updateById(commission);
            if (commission.getAmount() != null) {
                amount = amount.add(commission.getAmount());
            }
        }
        CommissionSettlement settlement = new CommissionSettlement();
        settlement.setBatchNo(batchNo);
        settlement.setChannelId(channelId);
        settlement.setPeriodStart(periodStart);
        settlement.setPeriodEnd(periodEnd);
        settlement.setCommissionCount(settleable.size());
        settlement.setAmount(amount);
        // 操作人取令牌账号。写死"平台运营"等于把审计字段变成装饰：出了纠纷查不到是谁点的。
        settlement.setOperator(operator == null || operator.isBlank() ? "unknown" : operator);
        settlement.setCreatedAt(now);
        settlementMapper.insert(settlement);
        return new SettlementResult(batchNo, settleable.size(), amount,
                blocked.size(), blocked.stream().map(Blocked::amount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add), blocked);
    }
}
