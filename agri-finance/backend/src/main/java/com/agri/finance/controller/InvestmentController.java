package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.Investment;
import com.agri.finance.entity.Asset;
import com.agri.finance.entity.FundProvider;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.impl.AssetServiceImpl;
import com.agri.finance.service.impl.FundAccountServiceImpl;
import com.agri.finance.service.impl.FundPortfolioServiceImpl;
import com.agri.finance.service.impl.FundProviderServiceImpl;
import com.agri.finance.service.impl.InvestmentServiceImpl;
import com.agri.finance.service.impl.MessageNotificationServiceImpl;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * 资金方投资。
 *
 * <p>机构号一律取当前登录者绑定的资金机构（{@code /mine} 系列），
 * 不再由前端把机构号写在路径或请求体里 —— 原先写死 {@code PROVIDER-BANK-001}，
 * 任何资金方登录后操作的都是这一家。</p>
 */
@RestController
@RequestMapping("/api/v1/investment")
@OperatorOnly("finance:fund")
public class InvestmentController {

    private final InvestmentServiceImpl investmentService;
    private final AssetServiceImpl assetService;
    private final FundProviderServiceImpl providerService;
    private final FundAccountServiceImpl accountService;
    private final FundPortfolioServiceImpl portfolioService;
    private final MessageNotificationServiceImpl messageService;
    private final FinanceIdentityService identityService;

    public InvestmentController(
            InvestmentServiceImpl investmentService,
            AssetServiceImpl assetService,
            FundProviderServiceImpl providerService,
            FundAccountServiceImpl accountService,
            FundPortfolioServiceImpl portfolioService,
            MessageNotificationServiceImpl messageService,
            FinanceIdentityService identityService) {
        this.investmentService = investmentService;
        this.assetService = assetService;
        this.providerService = providerService;
        this.accountService = accountService;
        this.portfolioService = portfolioService;
        this.messageService = messageService;
        this.identityService = identityService;
    }

    @PostMapping("/subscribe")
    @Transactional
    public Map<String, Object> subscribe(@RequestBody Map<String, Object> request) {
        String assetId = request.get("assetId") == null ? "" : request.get("assetId").toString();
        String providerId = identityService.currentProviderId();
        if (!providerService.lockForInvestment(providerId)) {
            return failure(404, "资金机构不存在或已停用");
        }
        FundProvider provider = providerService.getById(providerId);
        if (provider == null
                || !"已通过".equals(provider.getReviewStatus())
                || !Set.of("正常", "ACTIVE").contains(provider.getStatus())) {
            return failure(403, "资金机构尚未通过准入审核，不能配置资产");
        }

        BigDecimal amount;
        try {
            amount = request.get("amount") == null ? null : new BigDecimal(request.get("amount").toString());
        } catch (NumberFormatException error) {
            return failure(400, "投资金额格式不正确");
        }
        try {
            accountService.validateInvestment(providerId, amount);
        } catch (IllegalArgumentException error) {
            return failure(400, error.getMessage());
        }

        Asset asset = assetService.getAssetDetail(assetId);
        if (asset == null || Integer.valueOf(1).equals(asset.getDelFlag())) {
            return failure(404, "资产不存在");
        }
        if (!"可投资".equals(asset.getStatus())) {
            return failure(400, "该资产已售罄或停止募集");
        }
        if (asset.getAvailableAmount() == null || asset.getAvailableAmount().compareTo(amount) < 0) {
            return failure(400, "投资金额超过资产剩余可投额度");
        }

        BigDecimal principal = asset.getAmount() == null ? BigDecimal.ZERO : asset.getAmount();
        if (principal.signum() <= 0) {
            return failure(400, "资产发行金额配置无效");
        }
        BigDecimal ratio = (asset.getExpectedReturn() == null ? BigDecimal.ZERO : asset.getExpectedReturn())
                .divide(principal, 8, RoundingMode.HALF_UP);
        int term = asset.getTerm() == null || asset.getTerm() <= 0 ? 1 : asset.getTerm();

        Asset reserved = assetService.invest(asset.getId(), amount);
        if (reserved == null) {
            return failure(409, "资产额度刚刚发生变化，请刷新后重新配置");
        }

        Investment investment = new Investment();
        investment.setAssetId(asset.getId());
        investment.setAssetName(asset.getAssetName());
        investment.setProviderId(providerId);
        investment.setProviderName(provider.getInstitutionName());
        investment.setInvestmentAmount(amount);
        investment.setExpectedReturn(amount.multiply(ratio).setScale(2, RoundingMode.HALF_UP));
        investment.setTerm(term);
        investment.setInterestRate(ratio.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP));
        investment.setExpectedReturnTime(java.time.LocalDateTime.now().plusMonths(term));
        Investment result = investmentService.createInvestment(investment);
        messageService.notify(providerId, "ASSET", "资产资金配置成功",
                asset.getAssetName() + " 已配置 " + investment.getInvestmentAmount().toPlainString()
                        + " 元，预计回款 " + investment.getExpectedReturnTime().toLocalDate() + "。",
                "INVESTMENT", result.getId(), "HIGH");

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("investment", result);
        data.put("asset", assetService.assetView(reserved));
        data.put("account", accountService.account(providerId));
        return Map.of("code", 200, "message", "资金配置成功", "data", data);
    }

    @GetMapping("/mine")
    public Map<String, Object> myInvestments() {
        List<Investment> investments = investmentService.getInvestmentsByProvider(
                identityService.currentProviderId());
        return Map.of("code", 200, "message", "success", "data", investments);
    }

    @GetMapping("/mine/portfolio")
    public Map<String, Object> myPortfolio() {
        return Map.of("code", 200, "message", "success",
                "data", portfolioService.portfolio(identityService.currentProviderId()));
    }

    @GetMapping("/mine/total-return")
    public Map<String, Object> myTotalReturn() {
        return Map.of("code", 200, "message", "success", "data",
                investmentService.calculateTotalReturn(identityService.currentProviderId()));
    }

    @GetMapping("/mine/total-invested")
    public Map<String, Object> myTotalInvested() {
        return Map.of("code", 200, "message", "success", "data",
                investmentService.calculateTotalInvested(identityService.currentProviderId()));
    }

    @GetMapping("/{investmentId}")
    public Map<String, Object> getInvestmentDetail(@PathVariable String investmentId) {
        Investment investment = investmentService.getInvestmentDetail(investmentId);
        if (investment == null) {
            return Map.of("code", 404, "message", "投资记录不存在", "data", "");
        }
        // 运营可以跨机构核对，普通资金方只能看自己名下的投资
        identityService.providerIdFor(investment.getProviderId());
        return Map.of("code", 200, "message", "success", "data", investment);
    }

    @PostMapping("/complete/{investmentId}")
    @Transactional
    public Map<String, Object> completeInvestment(@PathVariable String investmentId) {
        String providerId = identityService.currentProviderId();
        Investment existing = investmentService.getById(investmentId);
        if (existing == null || Integer.valueOf(1).equals(existing.getDelFlag())) {
            return failure(404, "投资记录不存在");
        }
        if (!providerId.equals(existing.getProviderId()) && !identityService.hasPermission("finance:admin")) {
            return failure(403, "无权操作其他资金机构的投资记录");
        }
        if (!Set.of("投资中", "待回款").contains(existing.getStatus())) {
            return failure(409, "该投资当前状态不能确认回款");
        }
        Investment result = investmentService.completeInvestment(investmentId);
        if (result == null) {
            return failure(409, "投资状态已变化，请刷新后重试");
        }
        messageService.notify(result.getProviderId(), "REPAYMENT", "投资收益回款到账",
                result.getAssetName() + " 已完成回款，本息合计 "
                        + result.getActualReturnAmount().toPlainString() + " 元。",
                "INVESTMENT", result.getId(), "MEDIUM");
        return Map.of("code", 200, "message", "回款确认成功",
                "data", Map.of("investment", result, "account", accountService.account(result.getProviderId())));
    }

    private Map<String, Object> failure(int code, String message) {
        return Map.of("code", code, "message", message, "data", "");
    }
}
