package com.agri.finance.service.impl;

import com.agri.finance.entity.Investment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 资金机构账户视图。
 *
 * <p>资金额度是机构级配置，已配置本金按“投资中”和“待回款”状态占用。
 * 已完成投资释放额度，并在已实现收益中单独核算。</p>
 */
@Service
public class FundAccountServiceImpl {

    private static final Set<String> ACTIVE_STATUSES = Set.of("投资中", "待回款");

    private final InvestmentServiceImpl investmentService;

    @Value("${agri.fund.total-limit:50000000}")
    private BigDecimal totalLimit;

    @Value("${agri.fund.minimum-investment:1000}")
    private BigDecimal minimumInvestment;

    public FundAccountServiceImpl(InvestmentServiceImpl investmentService) {
        this.investmentService = investmentService;
    }

    public Map<String, Object> account(String providerId) {
        List<Investment> investments = investmentService.getInvestmentsByProvider(providerId);
        List<Investment> active = investments.stream()
                .filter(item -> ACTIVE_STATUSES.contains(item.getStatus()))
                .toList();
        List<Investment> completed = investments.stream()
                .filter(item -> "已完成".equals(item.getStatus()))
                .toList();

        BigDecimal committedAmount = sum(active, Investment::getInvestmentAmount);
        BigDecimal availableAmount = totalLimit.subtract(committedAmount).max(BigDecimal.ZERO);
        BigDecimal expectedReturn = sum(active, Investment::getExpectedReturn);
        BigDecimal returnedAmount = sum(completed, Investment::getActualReturnAmount);
        BigDecimal realizedIncome = completed.stream()
                .map(item -> nullToZero(item.getActualReturnAmount())
                        .subtract(nullToZero(item.getInvestmentAmount())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("providerId", providerId);
        result.put("totalLimit", scale(totalLimit));
        result.put("committedAmount", scale(committedAmount));
        result.put("availableAmount", scale(availableAmount));
        result.put("minimumInvestment", scale(minimumInvestment));
        result.put("utilizationRate", percentage(committedAmount, totalLimit));
        result.put("activeCount", active.size());
        result.put("completedCount", completed.size());
        result.put("expectedReturn", scale(expectedReturn));
        result.put("returnedAmount", scale(returnedAmount));
        result.put("realizedIncome", scale(realizedIncome));
        return result;
    }

    public void validateInvestment(String providerId, BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("投资金额必须大于 0");
        }
        if (amount.compareTo(minimumInvestment) < 0) {
            throw new IllegalArgumentException("投资金额不能低于起投金额 " + scale(minimumInvestment) + " 元");
        }
        BigDecimal available = decimal(account(providerId).get("availableAmount"));
        if (amount.compareTo(available) > 0) {
            throw new IllegalArgumentException("投资金额超过资金方可配置余额");
        }
    }

    private BigDecimal sum(List<Investment> rows, java.util.function.Function<Investment, BigDecimal> mapper) {
        return rows.stream()
                .map(mapper)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal decimal(Object value) {
        return value == null ? BigDecimal.ZERO : new BigDecimal(value.toString());
    }

    private BigDecimal percentage(BigDecimal value, BigDecimal total) {
        if (total == null || total.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        return value.multiply(BigDecimal.valueOf(100))
                .divide(total, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal scale(BigDecimal value) {
        return nullToZero(value).setScale(2, RoundingMode.HALF_UP);
    }
}
