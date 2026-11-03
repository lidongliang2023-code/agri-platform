package com.agri.finance.service.impl;

import com.agri.finance.entity.Asset;
import com.agri.finance.entity.Investment;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class FundPortfolioServiceImpl {

    private static final Set<String> ACTIVE_STATUSES = Set.of("投资中", "待回款");

    private final InvestmentServiceImpl investmentService;
    private final FundAccountServiceImpl accountService;
    private final AssetServiceImpl assetService;

    public FundPortfolioServiceImpl(
            InvestmentServiceImpl investmentService,
            FundAccountServiceImpl accountService,
            AssetServiceImpl assetService) {
        this.investmentService = investmentService;
        this.accountService = accountService;
        this.assetService = assetService;
    }

    public Map<String, Object> portfolio(String providerId) {
        List<Investment> investments = investmentService.getInvestmentsByProvider(providerId);
        LocalDateTime now = LocalDateTime.now();
        List<Map<String, Object>> items = investments.stream()
                .map(item -> investmentView(item, now))
                .toList();
        List<Investment> active = investments.stream()
                .filter(item -> ACTIVE_STATUSES.contains(item.getStatus()))
                .toList();
        List<Investment> completed = investments.stream()
                .filter(item -> "已完成".equals(item.getStatus()))
                .toList();
        List<Investment> dueSoon = active.stream()
                .filter(item -> item.getExpectedReturnTime() != null
                        && item.getExpectedReturnTime().isAfter(now)
                        && item.getExpectedReturnTime().isBefore(now.plusDays(30)))
                .sorted(Comparator.comparing(Investment::getExpectedReturnTime))
                .toList();
        List<Investment> overdue = active.stream()
                .filter(item -> item.getExpectedReturnTime() != null
                        && !item.getExpectedReturnTime().isAfter(now))
                .toList();

        BigDecimal activePrincipal = sum(active, Investment::getInvestmentAmount);
        BigDecimal expectedReturn = sum(active, Investment::getExpectedReturn);
        BigDecimal returnedAmount = completed.stream()
                .map(Investment::getActualReturnAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal realizedIncome = completed.stream()
                .map(item -> decimal(item.getActualReturnAmount()).subtract(decimal(item.getInvestmentAmount())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("investmentCount", investments.size());
        summary.put("totalInvested", scale(sum(investments, Investment::getInvestmentAmount)));
        summary.put("activeAmount", scale(activePrincipal));
        summary.put("activeCount", active.size());
        summary.put("pendingReturnCount", active.stream()
                .filter(item -> "待回款".equals(item.getStatus()))
                .count());
        summary.put("completedCount", completed.size());
        summary.put("expectedReturn", scale(expectedReturn));
        summary.put("returnedAmount", scale(returnedAmount));
        summary.put("realizedIncome", scale(realizedIncome));
        summary.put("dueSoonCount", dueSoon.size());
        summary.put("overdueCount", overdue.size());
        summary.put("completionRate", investments.isEmpty()
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(completed.size())
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(investments.size()), 2, RoundingMode.HALF_UP));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("account", accountService.account(providerId));
        result.put("summary", summary);
        result.put("investments", items);
        result.put("allocation", allocation(active));
        result.put("dueSchedule", dueSoon.stream().limit(6).map(item -> investmentView(item, now)).toList());
        result.put("overdueInvestments", overdue.stream().map(item -> investmentView(item, now)).toList());
        result.put("generatedAt", now);
        return result;
    }

    private Map<String, Object> investmentView(Investment investment, LocalDateTime now) {
        Asset asset = assetService.getById(investment.getAssetId());
        long days = investment.getExpectedReturnTime() == null
                ? 0
                : Duration.between(now, investment.getExpectedReturnTime()).toDays();
        boolean active = ACTIVE_STATUSES.contains(investment.getStatus());
        boolean overdue = active && days < 0;
        String nextAction;
        if ("已完成".equals(investment.getStatus())) {
            nextAction = "本息已回收";
        } else if (overdue) {
            nextAction = "已到期待回款，请立即跟进";
        } else if ("待回款".equals(investment.getStatus())) {
            nextAction = "待确认本息到账";
        } else {
            nextAction = "跟踪经营与到期回款";
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", investment.getId());
        result.put("investmentNo", investment.getInvestmentNo());
        result.put("assetId", investment.getAssetId());
        result.put("assetName", investment.getAssetName());
        result.put("assetType", asset == null ? "历史融资资产" : asset.getAssetType());
        result.put("borrowerName", asset == null ? null : asset.getBorrowerName());
        result.put("borrowerRating", asset == null ? null : asset.getBorrowerRating());
        result.put("collateralType", asset == null ? null : asset.getCollateralType());
        result.put("investmentAmount", scale(investment.getInvestmentAmount()));
        result.put("expectedReturn", scale(investment.getExpectedReturn()));
        result.put("expectedTotal", scale(decimal(investment.getInvestmentAmount())
                .add(decimal(investment.getExpectedReturn()))));
        result.put("interestRate", investment.getInterestRate());
        result.put("term", investment.getTerm());
        result.put("status", investment.getStatus());
        result.put("investmentTime", investment.getInvestmentTime());
        result.put("expectedReturnTime", investment.getExpectedReturnTime());
        result.put("actualReturnTime", investment.getActualReturnTime());
        result.put("actualReturnAmount", scale(investment.getActualReturnAmount()));
        result.put("remainingDays", days);
        result.put("overdue", overdue);
        result.put("nextAction", nextAction);
        return result;
    }

    private List<Map<String, Object>> allocation(List<Investment> active) {
        BigDecimal total = sum(active, Investment::getInvestmentAmount);
        Map<String, BigDecimal> grouped = new LinkedHashMap<>();
        for (Investment investment : active) {
            Asset asset = assetService.getById(investment.getAssetId());
            String type = asset == null || asset.getAssetType() == null
                    ? "历史融资资产" : asset.getAssetType();
            grouped.merge(type, decimal(investment.getInvestmentAmount()), BigDecimal::add);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        grouped.forEach((type, amount) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("type", type);
            item.put("amount", scale(amount));
            item.put("percent", total.signum() == 0
                    ? BigDecimal.ZERO
                    : amount.multiply(BigDecimal.valueOf(100))
                    .divide(total, 2, RoundingMode.HALF_UP));
            result.add(item);
        });
        result.sort(Comparator.comparing(
                item -> decimal(item.get("amount")),
                Comparator.reverseOrder()
        ));
        return result;
    }

    private BigDecimal sum(
            List<Investment> investments,
            java.util.function.Function<Investment, BigDecimal> mapper) {
        return investments.stream()
                .map(mapper)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal decimal(Object value) {
        return value == null ? BigDecimal.ZERO : new BigDecimal(value.toString());
    }

    private BigDecimal scale(BigDecimal value) {
        return decimal(value).setScale(2, RoundingMode.HALF_UP);
    }
}
