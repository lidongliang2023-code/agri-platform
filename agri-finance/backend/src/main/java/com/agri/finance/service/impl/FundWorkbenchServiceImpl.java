package com.agri.finance.service.impl;

import com.agri.finance.entity.Asset;
import com.agri.finance.entity.FundProvider;
import com.agri.finance.entity.Investment;
import com.agri.finance.entity.LoanApplication;
import com.agri.finance.entity.OverdueRecord;
import com.agri.finance.entity.RiskControlRule;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class FundWorkbenchServiceImpl {

    private static final Set<String> ACTIVE_STATUSES = Set.of("投资中", "待回款");
    private static final Set<String> CLOSED_OVERDUE_STATUSES = Set.of("已还款", "已关闭");

    private final FundProviderServiceImpl providerService;
    private final AssetServiceImpl assetService;
    private final InvestmentServiceImpl investmentService;
    private final FundAccountServiceImpl accountService;
    private final LoanApplicationServiceImpl applicationService;
    private final OverdueRecordServiceImpl overdueService;
    private final RiskControlRuleServiceImpl riskRuleService;
    private final MessageNotificationServiceImpl messageService;

    public FundWorkbenchServiceImpl(
            FundProviderServiceImpl providerService,
            AssetServiceImpl assetService,
            InvestmentServiceImpl investmentService,
            FundAccountServiceImpl accountService,
            LoanApplicationServiceImpl applicationService,
            OverdueRecordServiceImpl overdueService,
            RiskControlRuleServiceImpl riskRuleService,
            MessageNotificationServiceImpl messageService) {
        this.providerService = providerService;
        this.assetService = assetService;
        this.investmentService = investmentService;
        this.accountService = accountService;
        this.applicationService = applicationService;
        this.overdueService = overdueService;
        this.riskRuleService = riskRuleService;
        this.messageService = messageService;
    }

    public Map<String, Object> workbench(String providerId) {
        FundProvider provider = providerService.getById(providerId);
        List<Investment> investments = investmentService.getInvestmentsByProvider(providerId);
        List<Asset> assets = assetService.getAvailableAssets();
        List<LoanApplication> applications = applicationService.list(
                new LambdaQueryWrapper<LoanApplication>()
                        .eq(LoanApplication::getDelFlag, 0)
                        .orderByDesc(LoanApplication::getApplyTime)
        );
        List<OverdueRecord> overdue = overdueService.list(
                new LambdaQueryWrapper<OverdueRecord>()
                        .eq(OverdueRecord::getDelFlag, 0)
                        .notIn(OverdueRecord::getStatus, CLOSED_OVERDUE_STATUSES)
        );
        List<RiskControlRule> enabledRules = riskRuleService.getEnabledRules();
        long unreadMessages = messageService.getUnreadCount(providerId);

        List<Investment> activeInvestments = investments.stream()
                .filter(item -> ACTIVE_STATUSES.contains(item.getStatus()))
                .toList();
        List<Investment> completedInvestments = investments.stream()
                .filter(item -> "已完成".equals(item.getStatus()))
                .toList();
        List<LoanApplication> pendingApplications = applications.stream()
                .filter(item -> "待审批".equals(item.getStatus()))
                .toList();
        LocalDateTime dueCutoff = LocalDateTime.now().plusDays(30);
        List<Investment> dueSoon = activeInvestments.stream()
                .filter(item -> item.getExpectedReturnTime() != null
                        && !item.getExpectedReturnTime().isAfter(dueCutoff))
                .sorted(Comparator.comparing(Investment::getExpectedReturnTime))
                .toList();

        List<Map<String, Object>> assetViews = new ArrayList<>();
        for (Asset asset : assets) {
            Map<String, Object> view = assetService.assetView(asset);
            view.put("myInvestedAmount", investmentService.calculateProviderAssetInvestment(providerId, asset.getId()));
            view.put("investorCount", investmentService.countByAsset(asset.getId()));
            assetViews.add(view);
        }
        assetViews.sort(Comparator.comparing(
                item -> decimal(item.get("aiRecommendationScore")),
                Comparator.reverseOrder()
        ));

        BigDecimal totalAvailableAmount = assets.stream()
                .map(Asset::getAvailableAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal averageScore = assets.stream()
                .map(Asset::getAiRecommendationScore)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (!assets.isEmpty()) {
            averageScore = averageScore.divide(BigDecimal.valueOf(assets.size()), 2, RoundingMode.HALF_UP);
        }
        long iotAssetCount = assets.stream().filter(item -> Boolean.TRUE.equals(item.getIotMonitored())).count();

        Map<String, Object> tasks = new LinkedHashMap<>();
        tasks.put("pendingApprovals", pendingApplications.size());
        tasks.put("pendingApprovalAmount", sumApplications(pendingApplications));
        tasks.put("dueSoonCount", dueSoon.size());
        tasks.put("nextDueTime", dueSoon.isEmpty() ? null : dueSoon.get(0).getExpectedReturnTime());
        tasks.put("overdueCount", overdue.size());
        tasks.put("unreadMessages", unreadMessages);
        tasks.put("enabledRules", enabledRules.size());

        List<Map<String, Object>> risks = new ArrayList<>();
        if (!overdue.isEmpty()) {
            risks.add(risk("HIGH", "存量业务存在逾期", overdue.size() + " 笔逾期业务尚未关闭，请进入逾期管理跟进。"));
        }
        if (!dueSoon.isEmpty()) {
            risks.add(risk("MEDIUM", "近期回款任务", dueSoon.size() + " 笔投资将在 30 天内到期，请提前确认回款资金。"));
        }
        Map<String, Object> account = accountService.account(providerId);
        if (decimal(account.get("utilizationRate")).compareTo(BigDecimal.valueOf(80)) >= 0) {
            risks.add(risk("MEDIUM", "资金额度接近上限", "当前资金额度使用率 "
                    + account.get("utilizationRate") + "%，新增配置前请确认可用头寸。"));
        }
        if (risks.isEmpty()) {
            risks.add(risk("LOW", "资金组合运行正常", "当前无逾期、到期或额度预警。"));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("provider", provider);
        result.put("account", account);
        result.put("tasks", tasks);
        result.put("risks", risks);
        result.put("portfolio", portfolio(activeInvestments, completedInvestments, investments));
        result.put("market", Map.of(
                "assetCount", assets.size(),
                "availableAmount", scale(totalAvailableAmount),
                "averageScore", averageScore,
                "iotAssetCount", iotAssetCount
        ));
        result.put("recommendedAssets", assetViews.stream().limit(3).toList());
        result.put("investments", investments.stream().limit(6).toList());
        result.put("upcomingReturns", dueSoon.stream().limit(5).map(this::investmentView).toList());
        result.put("generatedAt", LocalDateTime.now());
        return result;
    }

    public Map<String, Object> market(String providerId) {
        FundProvider provider = providerService.getById(providerId);
        List<Asset> assets = assetService.getAvailableAssets();
        List<Map<String, Object>> marketAssets = new ArrayList<>();
        for (Asset asset : assets) {
            Map<String, Object> view = assetService.assetView(asset);
            view.put("myInvestedAmount", investmentService.calculateProviderAssetInvestment(providerId, asset.getId()));
            view.put("investorCount", investmentService.countByAsset(asset.getId()));
            marketAssets.add(view);
        }
        marketAssets.sort(Comparator
                .comparing((Map<String, Object> item) -> decimal(item.get("aiRecommendationScore")))
                .thenComparing((Map<String, Object> item) -> decimal(item.get("annualizedRate")))
                .reversed());

        BigDecimal amount = assets.stream()
                .map(Asset::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal available = assets.stream()
                .map(Asset::getAvailableAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal averageScore = assets.stream()
                .map(Asset::getAiRecommendationScore)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (!assets.isEmpty()) {
            averageScore = averageScore.divide(BigDecimal.valueOf(assets.size()), 2, RoundingMode.HALF_UP);
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("assetCount", assets.size());
        summary.put("totalAmount", scale(amount));
        summary.put("availableAmount", scale(available));
        summary.put("averageScore", averageScore);
        summary.put("iotAssetCount", assets.stream().filter(item -> Boolean.TRUE.equals(item.getIotMonitored())).count());
        summary.put("collateralAssetCount", assets.stream()
                .filter(item -> item.getCollateralType() != null && !item.getCollateralType().isBlank())
                .count());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("provider", provider);
        result.put("account", accountService.account(providerId));
        result.put("summary", summary);
        result.put("assets", marketAssets);
        result.put("generatedAt", LocalDateTime.now());
        return result;
    }

    public Map<String, Object> assetDetail(String providerId, String assetId) {
        Asset asset = assetService.getAssetDetail(assetId);
        if (asset == null || Integer.valueOf(1).equals(asset.getDelFlag())) {
            throw new IllegalArgumentException("资产不存在或已下线");
        }
        Map<String, Object> view = assetService.assetView(asset);
        view.put("myInvestedAmount", investmentService.calculateProviderAssetInvestment(providerId, assetId));
        view.put("investorCount", investmentService.countByAsset(assetId));
        view.put("marketAverageScore", market(providerId).get("summary"));
        view.put("account", accountService.account(providerId));
        view.put("provider", providerService.getById(providerId));
        view.put("fundingSteps", List.of(
                step("已发布", "资产完成平台审核并进入市场", true),
                step("资金配置", "资金方核验收益、期限与风险后认购",
                        decimal(view.get("myInvestedAmount")).signum() > 0),
                step("募集完成", "资产可用额度归零后停止认购", decimal(view.get("fundingProgress")).compareTo(BigDecimal.valueOf(100)) >= 0),
                step("到期回款", "借款人按合同回款，资金方确认本息到账", false)
        ));
        view.put("riskEvidence", List.of(
                evidence("主体信用", asset.getBorrowerRating() == null ? "待补充" : asset.getBorrowerRating() + " 级",
                        "融资主体历史履约与平台信用评级"),
                evidence("AI 推荐", trimNumber(asset.getAiRecommendationScore()) + " 分",
                        asset.getRecommendationReason() == null ? "暂无推荐说明" : asset.getRecommendationReason()),
                evidence("风险缓释", asset.getCollateralType() == null ? "信用融资" : asset.getCollateralType(),
                        "质押率 " + trimNumber(asset.getPledgeRate()) + "%，结合平台仓单与交易数据核验"),
                evidence("贷后监控", Boolean.TRUE.equals(asset.getIotMonitored()) ? "IoT 已接入" : "待接入",
                        Boolean.TRUE.equals(asset.getIotMonitored()) ? "生产、仓储及物流数据持续监测" : "需人工跟踪经营与回款变化")
        ));
        return view;
    }

    private Map<String, Object> portfolio(
            List<Investment> active,
            List<Investment> completed,
            List<Investment> all) {
        BigDecimal invested = sumInvestments(all);
        BigDecimal activeAmount = sumInvestments(active);
        BigDecimal expectedReturn = active.stream()
                .map(Investment::getExpectedReturn)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal returnedAmount = completed.stream()
                .map(Investment::getActualReturnAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalInvested", scale(invested));
        result.put("activeAmount", scale(activeAmount));
        result.put("activeCount", active.size());
        result.put("completedCount", completed.size());
        result.put("expectedReturn", scale(expectedReturn));
        result.put("returnedAmount", scale(returnedAmount));
        result.put("realizedIncome", scale(completed.stream()
                .map(item -> decimal(item.getActualReturnAmount()).subtract(decimal(item.getInvestmentAmount())))
                .reduce(BigDecimal.ZERO, BigDecimal::add)));
        return result;
    }

    private Map<String, Object> investmentView(Investment investment) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", investment.getId());
        result.put("investmentNo", investment.getInvestmentNo());
        result.put("assetId", investment.getAssetId());
        result.put("assetName", investment.getAssetName());
        result.put("investmentAmount", investment.getInvestmentAmount());
        result.put("expectedReturn", investment.getExpectedReturn());
        result.put("expectedReturnTime", investment.getExpectedReturnTime());
        result.put("status", investment.getStatus());
        return result;
    }

    private Map<String, Object> risk(String level, String title, String detail) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("level", level);
        result.put("title", title);
        result.put("detail", detail);
        return result;
    }

    private Map<String, Object> step(String title, String description, boolean done) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("title", title);
        result.put("description", description);
        result.put("done", done);
        return result;
    }

    private Map<String, Object> evidence(String label, String value, String description) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("label", label);
        result.put("value", value);
        result.put("description", description);
        return result;
    }

    private BigDecimal sumApplications(List<LoanApplication> rows) {
        return scale(rows.stream()
                .map(LoanApplication::getApplyAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private BigDecimal sumInvestments(List<Investment> rows) {
        return rows.stream()
                .map(Investment::getInvestmentAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal decimal(Object value) {
        return value == null ? BigDecimal.ZERO : new BigDecimal(value.toString());
    }

    private BigDecimal scale(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private String trimNumber(BigDecimal value) {
        if (value == null) {
            return "0";
        }
        return value.stripTrailingZeros().toPlainString();
    }
}
