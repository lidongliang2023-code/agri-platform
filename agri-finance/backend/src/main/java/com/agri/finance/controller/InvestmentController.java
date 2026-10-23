package com.agri.finance.controller;

import com.agri.finance.entity.Investment;
import com.agri.finance.entity.Asset;
import com.agri.finance.service.impl.AssetServiceImpl;
import com.agri.finance.service.impl.InvestmentServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/investment")
public class InvestmentController {

    @Autowired
    private InvestmentServiceImpl investmentService;
    @Autowired
    private AssetServiceImpl assetService;

    @PostMapping("/create")
    public Map<String, Object> createInvestment(@RequestBody Investment investment) {
        Investment result = investmentService.createInvestment(investment);
        return Map.of("code", 200, "message", "投资成功", "data", result);
    }

    @PostMapping("/subscribe")
    @Transactional
    public Map<String, Object> subscribe(@RequestBody Map<String, Object> request) {
        String assetId = request.get("assetId") == null ? "" : request.get("assetId").toString();
        String providerId = request.get("providerId") == null ? "" : request.get("providerId").toString();
        String providerName = request.get("providerName") == null ? "合作资金机构" : request.get("providerName").toString();
        BigDecimal amount = request.get("amount") == null ? null : new BigDecimal(request.get("amount").toString());
        Asset asset = assetService.getAssetDetail(assetId);
        if (asset == null || !"可投资".equals(asset.getStatus())) {
            return Map.of("code", 400, "message", "该资产当前不可投资", "data", "");
        }
        if (providerId.isBlank() || amount == null || amount.signum() <= 0) {
            return Map.of("code", 400, "message", "请填写资金方和投资金额", "data", "");
        }
        if (asset.getAvailableAmount() == null || asset.getAvailableAmount().compareTo(amount) < 0) {
            return Map.of("code", 400, "message", "投资金额超过资产可投余额", "data", "");
        }
        BigDecimal ratio = asset.getAmount() == null || asset.getAmount().signum() == 0
                ? BigDecimal.ZERO
                : asset.getExpectedReturn().divide(asset.getAmount(), 8, java.math.RoundingMode.HALF_UP);
        Investment investment = new Investment();
        investment.setAssetId(asset.getId());
        investment.setAssetName(asset.getAssetName());
        investment.setProviderId(providerId);
        investment.setProviderName(providerName);
        investment.setInvestmentAmount(amount);
        investment.setExpectedReturn(amount.multiply(ratio).setScale(2, java.math.RoundingMode.HALF_UP));
        investment.setTerm(asset.getTerm());
        investment.setInterestRate(ratio.multiply(new BigDecimal("100")).setScale(2, java.math.RoundingMode.HALF_UP));
        investment.setExpectedReturnTime(java.time.LocalDateTime.now().plusMonths(asset.getTerm()));
        Investment result = investmentService.createInvestment(investment);
        assetService.invest(asset.getId(), amount);
        return Map.of("code", 200, "message", "投资成功", "data", result);
    }

    @GetMapping("/provider/{providerId}")
    public Map<String, Object> getInvestmentsByProvider(@PathVariable String providerId) {
        List<Investment> investments = investmentService.getInvestmentsByProvider(providerId);
        return Map.of("code", 200, "message", "success", "data", investments);
    }

    @GetMapping("/{investmentId}")
    public Map<String, Object> getInvestmentDetail(@PathVariable String investmentId) {
        Investment investment = investmentService.getInvestmentDetail(investmentId);
        return Map.of("code", 200, "message", "success", "data", investment);
    }

    @PostMapping("/complete/{investmentId}")
    public Map<String, Object> completeInvestment(@PathVariable String investmentId) {
        Investment result = investmentService.completeInvestment(investmentId);
        return Map.of("code", 200, "message", "已完成", "data", result);
    }

    @GetMapping("/total-return/{providerId}")
    public Map<String, Object> getTotalReturn(@PathVariable String providerId) {
        BigDecimal totalReturn = investmentService.calculateTotalReturn(providerId);
        return Map.of("code", 200, "message", "success", "data", totalReturn);
    }

    @GetMapping("/total-invested/{providerId}")
    public Map<String, Object> getTotalInvested(@PathVariable String providerId) {
        BigDecimal totalInvested = investmentService.calculateTotalInvested(providerId);
        return Map.of("code", 200, "message", "success", "data", totalInvested);
    }
}
