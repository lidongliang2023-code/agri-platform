package com.agri.finance.service.impl;

import com.agri.finance.entity.Asset;
import com.agri.finance.entity.LoanApplication;
import com.agri.finance.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AssetServiceImpl extends ServiceImpl<AssetMapper, Asset> {

    public Asset publishAsset(Asset asset) {
        asset.setAssetNo("AST" + System.currentTimeMillis());
        asset.setStatus("可投资");
        asset.setAvailableAmount(asset.getAmount());
        asset.setInvestedAmount(BigDecimal.ZERO);
        asset.setPublishTime(LocalDateTime.now());
        asset.setCreatedAt(LocalDateTime.now());
        asset.setUpdatedAt(LocalDateTime.now());
        asset.setDelFlag(0);
        save(asset);
        return asset;
    }

    public List<Asset> getAvailableAssets() {
        LambdaQueryWrapper<Asset> query = new LambdaQueryWrapper<>();
        query.eq(Asset::getStatus, "可投资")
             .eq(Asset::getDelFlag, 0)
             .orderByDesc(Asset::getPublishTime);
        return list(query);
    }

    public List<Asset> getAssetsByProvider(String providerId) {
        LambdaQueryWrapper<Asset> query = new LambdaQueryWrapper<>();
        query.eq(Asset::getProviderId, providerId)
             .eq(Asset::getDelFlag, 0)
             .orderByDesc(Asset::getCreatedAt);
        return list(query);
    }

    public Asset getAssetDetail(String assetId) {
        return getById(assetId);
    }

    public Asset invest(String assetId, BigDecimal amount) {
        if (amount == null || amount.signum() <= 0 || baseMapper.reserveAmount(assetId, amount) == 0) {
            return null;
        }
        return getById(assetId);
    }

    public void offlineAsset(String assetId) {
        Asset asset = getById(assetId);
        if (asset != null) {
            asset.setStatus("已下线");
            asset.setUpdatedAt(LocalDateTime.now());
            updateById(asset);
        }
    }

    /**
     * 审批通过后将融资申请转为资金方可配置的资产，作为审批到投资的业务衔接。
     * 使用申请 ID 生成稳定资产 ID，重复调用不会重复发行。
     */
    public Asset createFromApprovedApplication(LoanApplication application, String providerId) {
        String assetId = approvedApplicationAssetId(application.getId());
        Asset existing = getById(assetId);
        if (existing != null && !Integer.valueOf(1).equals(existing.getDelFlag())) {
            return existing;
        }

        BigDecimal amount = application.getActualAmount() == null
                ? application.getApplyAmount() : application.getActualAmount();
        BigDecimal annualRate = application.getActualRate() == null
                ? application.getSuggestedRate() : application.getActualRate();
        int term = application.getApplyTerm() == null || application.getApplyTerm() <= 0
                ? 1 : application.getApplyTerm();
        BigDecimal expectedReturn = amount
                .multiply(annualRate == null ? BigDecimal.ZERO : annualRate)
                .multiply(BigDecimal.valueOf(term))
                .divide(BigDecimal.valueOf(1200), 2, RoundingMode.HALF_UP);

        Asset asset = new Asset();
        asset.setId(assetId);
        asset.setAssetNo("FA-" + application.getApplicationNo());
        asset.setAssetName(application.getUserName() + " · " + productLabel(application.getProductType()) + "资产");
        asset.setAssetType(productLabel(application.getProductType()));
        asset.setFinancingScenario(application.getProductType());
        asset.setAmount(amount);
        asset.setExpectedReturn(expectedReturn);
        asset.setTerm(term);
        asset.setPledgeRate(application.getCollateralInfo() == null
                || application.getCollateralInfo().isBlank()
                ? BigDecimal.ZERO : BigDecimal.valueOf(65));
        asset.setBorrowerId(application.getUserId());
        asset.setBorrowerName(application.getUserName());
        asset.setBorrowerRating(application.getCreditLevel());
        asset.setCollateralType(application.getCollateralInfo());
        asset.setIotMonitored(application.getCollateralInfo() != null
                && !application.getCollateralInfo().isBlank());
        BigDecimal aiScore = application.getAiConfidence() == null
                ? BigDecimal.valueOf(75)
                : application.getAiConfidence().multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
        asset.setAiRecommendationScore(aiScore.min(BigDecimal.valueOf(99)));
        asset.setRecommendationReason("融资申请 " + application.getApplicationNo()
                + " 已完成资金方审批，审批金额 " + amount.toPlainString()
                + " 元，年化利率 " + (annualRate == null ? "0" : annualRate.toPlainString())
                + "%。" + (application.getReviewOpinion() == null ? "" : " " + application.getReviewOpinion()));
        asset.setStatus("可投资");
        asset.setAvailableAmount(amount);
        asset.setInvestedAmount(BigDecimal.ZERO);
        asset.setProviderId(providerId);
        asset.setPublishTime(LocalDateTime.now());
        asset.setCreatedAt(LocalDateTime.now());
        asset.setUpdatedAt(LocalDateTime.now());
        asset.setDelFlag(0);
        save(asset);
        return asset;
    }

    public static String approvedApplicationAssetId(String applicationId) {
        return "ASSET-APP-" + UUID.nameUUIDFromBytes(
                ("finance-approval:" + applicationId).getBytes(StandardCharsets.UTF_8)
        );
    }

    public Map<String, Object> assetView(Asset asset) {
        if (asset == null) {
            return Map.of();
        }
        BigDecimal amount = nullToZero(asset.getAmount());
        BigDecimal invested = nullToZero(asset.getInvestedAmount());
        BigDecimal available = nullToZero(asset.getAvailableAmount());
        BigDecimal expectedReturn = nullToZero(asset.getExpectedReturn());
        BigDecimal progress = amount.signum() == 0
                ? BigDecimal.ZERO
                : invested.multiply(BigDecimal.valueOf(100)).divide(amount, 2, RoundingMode.HALF_UP);
        BigDecimal holdingRate = amount.signum() == 0
                ? BigDecimal.ZERO
                : expectedReturn.multiply(BigDecimal.valueOf(100)).divide(amount, 2, RoundingMode.HALF_UP);
        int term = asset.getTerm() == null || asset.getTerm() <= 0 ? 1 : asset.getTerm();
        BigDecimal annualizedRate = holdingRate.multiply(BigDecimal.valueOf(12))
                .divide(BigDecimal.valueOf(term), 2, RoundingMode.HALF_UP);
        int riskLevel = recommendationRisk(asset.getAiRecommendationScore());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asset.getId());
        result.put("assetNo", asset.getAssetNo());
        result.put("assetName", asset.getAssetName());
        result.put("assetType", asset.getAssetType());
        result.put("financingScenario", asset.getFinancingScenario());
        result.put("amount", scale(amount));
        result.put("expectedReturn", scale(expectedReturn));
        result.put("term", asset.getTerm());
        result.put("pledgeRate", scale(nullToZero(asset.getPledgeRate())));
        result.put("borrowerId", asset.getBorrowerId());
        result.put("borrowerName", asset.getBorrowerName());
        result.put("borrowerRating", asset.getBorrowerRating());
        result.put("collateralType", asset.getCollateralType());
        result.put("iotMonitored", Boolean.TRUE.equals(asset.getIotMonitored()));
        result.put("aiRecommendationScore", scale(nullToZero(asset.getAiRecommendationScore())));
        result.put("recommendationReason", asset.getRecommendationReason());
        result.put("riskLevel", riskLevel);
        result.put("status", asset.getStatus());
        result.put("availableAmount", scale(available));
        result.put("investedAmount", scale(invested));
        result.put("fundingProgress", progress);
        result.put("holdingPeriodRate", holdingRate);
        result.put("annualizedRate", annualizedRate);
        result.put("publishTime", asset.getPublishTime());
        result.put("updatedAt", asset.getUpdatedAt());
        return result;
    }

    private int recommendationRisk(BigDecimal score) {
        if (score == null) {
            return 3;
        }
        if (score.compareTo(BigDecimal.valueOf(92)) >= 0) {
            return 1;
        }
        if (score.compareTo(BigDecimal.valueOf(85)) >= 0) {
            return 2;
        }
        return 3;
    }

    private String productLabel(String productType) {
        if (productType == null) {
            return "综合融资";
        }
        return switch (productType) {
            case "agri" -> "农资贷";
            case "purchase" -> "收购贷";
            case "sales" -> "销售贷";
            case "machine" -> "农机贷";
            case "data" -> "数据信用贷";
            default -> productType;
        };
    }

    private BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal scale(BigDecimal value) {
        return nullToZero(value).setScale(2, RoundingMode.HALF_UP);
    }
}
