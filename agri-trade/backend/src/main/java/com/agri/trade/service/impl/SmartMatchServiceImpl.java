package com.agri.trade.service.impl;

import com.agri.trade.entity.Demand;
import com.agri.trade.entity.MatchRecord;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.entity.TradeProductCategory;
import com.agri.trade.mapper.DemandMapper;
import com.agri.trade.mapper.MatchRecordMapper;
import com.agri.trade.mapper.TradeProductCategoryMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.service.ISmartMatchService;
import com.agri.trade.vo.MatchResultVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SmartMatchServiceImpl implements ISmartMatchService {

    private final DemandMapper demandMapper;
    private final TradeProductMapper productMapper;
    private final MatchRecordMapper matchRecordMapper;
    private final TradeProductCategoryMapper categoryMapper;

    private static final double CATEGORY_WEIGHT = 0.30;
    private static final double PRICE_WEIGHT = 0.15;
    private static final double DISTANCE_WEIGHT = 0.15;
    private static final double QUALITY_WEIGHT = 0.20;
    private static final double REPUTATION_WEIGHT = 0.10;
    private static final double PREFERENCE_WEIGHT = 0.10;

    @Override
    public List<MatchResultVO> matchDemandToProducts(Long demandId, int limit) {
        Demand demand = demandMapper.selectById(demandId);
        if (demand == null) {
            return Collections.emptyList();
        }

        List<TradeProduct> candidateProducts = findCandidateProducts(demand);

        List<MatchResultVO> matchResults = candidateProducts.stream()
                .map(product -> calculateMatchScore(demand, product))
                .filter(result -> result.getMatchScore().compareTo(BigDecimal.ZERO) > 0)
                .sorted((a, b) -> b.getMatchScore().compareTo(a.getMatchScore()))
                .limit(limit)
                .collect(Collectors.toList());

        batchCreateMatchRecords(demandId, matchResults.stream()
                .map(MatchResultVO::getProductId)
                .collect(Collectors.toList()));

        return matchResults;
    }

    @Override
    public List<MatchResultVO> matchProductToDemands(Long productId, int limit) {
        TradeProduct product = productMapper.selectById(productId);
        if (product == null) {
            return Collections.emptyList();
        }

        List<Demand> candidateDemands = findCandidateDemands(product);

        return candidateDemands.stream()
                .map(demand -> calculateMatchScore(demand, product))
                .filter(result -> result.getMatchScore().compareTo(BigDecimal.ZERO) > 0)
                .sorted((a, b) -> b.getMatchScore().compareTo(a.getMatchScore()))
                .limit(limit)
                .collect(Collectors.toList());
    }

    @Override
    public MatchResultVO calculateMatchScore(Demand demand, TradeProduct product) {
        MatchResultVO result = new MatchResultVO();
        result.setDemandId(demand.getId());
        result.setDemandNo(demand.getDemandNo());
        result.setProductId(product.getId());
        result.setProductName(product.getProductName());
        result.setProductCode(product.getProductCode());
        result.setSellerId(product.getSellerId());
        result.setSellerName(product.getSellerName());

        Map<String, Double> dimensionScores = calculateDimensionScores(demand, product);

        double categoryScore = dimensionScores.getOrDefault("category", 0.0);
        double priceScore = dimensionScores.getOrDefault("price", 0.0);
        double distanceScore = dimensionScores.getOrDefault("distance", 0.0);
        double qualityScore = dimensionScores.getOrDefault("quality", 0.0);
        double reputationScore = dimensionScores.getOrDefault("reputation", 0.0);
        double preferenceScore = dimensionScores.getOrDefault("preference", 0.0);

        double totalScore = categoryScore * CATEGORY_WEIGHT +
                priceScore * PRICE_WEIGHT +
                distanceScore * DISTANCE_WEIGHT +
                qualityScore * QUALITY_WEIGHT +
                reputationScore * REPUTATION_WEIGHT +
                preferenceScore * PREFERENCE_WEIGHT;

        BigDecimal finalScore = BigDecimal.valueOf(totalScore * 100).setScale(2, RoundingMode.HALF_UP);
        result.setMatchScore(finalScore);
        result.setMatchLevel(getMatchLevel(finalScore));
        result.setMatchReason(generateMatchReason(dimensionScores));
        result.setDimensionScores(dimensionScores);
        result.setCategoryScore(BigDecimal.valueOf(categoryScore * 100).setScale(2, RoundingMode.HALF_UP));
        result.setPriceScore(BigDecimal.valueOf(priceScore * 100).setScale(2, RoundingMode.HALF_UP));
        result.setDistanceScore(BigDecimal.valueOf(distanceScore * 100).setScale(2, RoundingMode.HALF_UP));
        result.setQualityScore(BigDecimal.valueOf(qualityScore * 100).setScale(2, RoundingMode.HALF_UP));
        result.setReputationScore(BigDecimal.valueOf(reputationScore * 100).setScale(2, RoundingMode.HALF_UP));

        return result;
    }

    @Override
    public Map<String, Double> calculateDimensionScores(Demand demand, TradeProduct product) {
        Map<String, Double> scores = new HashMap<>();

        scores.put("category", calculateCategoryScore(demand, product));
        scores.put("price", calculatePriceScore(demand, product));
        scores.put("distance", calculateDistanceScore(demand, product));
        scores.put("quality", calculateQualityScore(demand, product));
        scores.put("reputation", calculateReputationScore(product));
        scores.put("preference", calculatePreferenceScore(demand, product));

        return scores;
    }

    private double calculateCategoryScore(Demand demand, TradeProduct product) {
        if (demand.getCategoryId() == null || product.getCategoryId() == null) {
            return 0.5;
        }

        if (demand.getCategoryId().equals(product.getCategoryId())) {
            return 1.0;
        }

        TradeProductCategory demandCategory = categoryMapper.selectById(demand.getCategoryId());
        TradeProductCategory productCategory = categoryMapper.selectById(product.getCategoryId());

        if (demandCategory != null && productCategory != null) {
            if (Objects.equals(demandCategory.getParentId(), productCategory.getParentId())) {
                return 0.8;
            }
            if (demandCategory.getLevel() > 1 && demandCategory.getParentId().equals(productCategory.getId())) {
                return 0.7;
            }
        }

        return 0.3;
    }

    private double calculatePriceScore(Demand demand, TradeProduct product) {
        if (demand.getPriceMin() == null && demand.getPriceMax() == null) {
            return 0.7;
        }

        BigDecimal productPrice = product.getPrice() != null ? product.getPrice() :
                (product.getPriceMin() != null ? product.getPriceMin() : BigDecimal.ZERO);

        if (demand.getPriceMin() != null && demand.getPriceMax() != null) {
            if (productPrice.compareTo(demand.getPriceMin()) >= 0 &&
                    productPrice.compareTo(demand.getPriceMax()) <= 0) {
                return 1.0;
            } else if (productPrice.compareTo(demand.getPriceMax().multiply(BigDecimal.valueOf(1.1))) <= 0) {
                return 0.7;
            } else if (productPrice.compareTo(demand.getPriceMax().multiply(BigDecimal.valueOf(1.3))) <= 0) {
                return 0.5;
            } else {
                return 0.2;
            }
        } else if (demand.getPriceMax() != null && productPrice.compareTo(demand.getPriceMax()) <= 0) {
            return 0.9;
        } else if (demand.getPriceMin() != null && productPrice.compareTo(demand.getPriceMin()) >= 0) {
            return 0.8;
        }

        return 0.5;
    }

    private double calculateDistanceScore(Demand demand, TradeProduct product) {
        String demandProvince = demand.getDeliveryProvince();
        String demandCity = demand.getDeliveryCity();
        String productProvince = product.getOriginProvince();
        String productCity = product.getOriginCity();

        if (demandProvince == null || productProvince == null) {
            return 0.5;
        }

        if (demandProvince.equals(productProvince)) {
            if (demandCity != null && productCity != null && demandCity.equals(productCity)) {
                return 1.0;
            }
            return 0.8;
        }

        double distance = estimateDistance(demandProvince, productProvince);
        if (distance <= 200) return 0.9;
        if (distance <= 500) return 0.7;
        if (distance <= 1000) return 0.5;
        if (distance <= 2000) return 0.3;

        return 0.2;
    }

    private double estimateDistance(String province1, String province2) {
        Map<String, Double> provinceCenters = new HashMap<>();
        provinceCenters.put("北京市", 0.0);
        provinceCenters.put("天津市", 120.0);
        provinceCenters.put("河北省", 200.0);
        provinceCenters.put("山西省", 400.0);
        provinceCenters.put("内蒙古自治区", 800.0);
        provinceCenters.put("辽宁省", 600.0);
        provinceCenters.put("吉林省", 800.0);
        provinceCenters.put("黑龙江省", 1000.0);
        provinceCenters.put("上海市", 1200.0);
        provinceCenters.put("江苏省", 1100.0);
        provinceCenters.put("浙江省", 1300.0);
        provinceCenters.put("安徽省", 1000.0);
        provinceCenters.put("福建省", 1500.0);
        provinceCenters.put("江西省", 1200.0);
        provinceCenters.put("山东省", 600.0);
        provinceCenters.put("河南省", 800.0);
        provinceCenters.put("湖北省", 1000.0);
        provinceCenters.put("湖南省", 1200.0);
        provinceCenters.put("广东省", 1600.0);
        provinceCenters.put("广西壮族自治区", 1700.0);
        provinceCenters.put("海南省", 2000.0);
        provinceCenters.put("重庆市", 1400.0);
        provinceCenters.put("四川省", 1500.0);
        provinceCenters.put("贵州省", 1500.0);
        provinceCenters.put("云南省", 1800.0);
        provinceCenters.put("西藏自治区", 2500.0);
        provinceCenters.put("陕西省", 800.0);
        provinceCenters.put("甘肃省", 1200.0);
        provinceCenters.put("青海省", 1800.0);
        provinceCenters.put("宁夏回族自治区", 1000.0);
        provinceCenters.put("新疆维吾尔自治区", 2500.0);

        Double lat1 = provinceCenters.getOrDefault(province1, 500.0);
        Double lat2 = provinceCenters.getOrDefault(province2, 500.0);

        return Math.abs(lat1 - lat2);
    }

    private double calculateQualityScore(Demand demand, TradeProduct product) {
        double score = 0.6;

        String demandLevel = demand.getQualityRequirement();
        String productLevel = product.getSpecLevel();

        if (demandLevel != null && productLevel != null) {
            if ("优等".equals(demandLevel) && "优等".equals(productLevel)) {
                score += 0.3;
            } else if (("一级".equals(demandLevel) || "二级".equals(demandLevel)) &&
                    ("优等".equals(productLevel) || "一级".equals(productLevel))) {
                score += 0.2;
            } else if (demandLevel.equals(productLevel)) {
                score += 0.1;
            }
        }

        if (demand.getCertificationRequire() != null) {
            if (product.getCertificationJson() != null) {
                if (demand.getCertificationRequire().contains("绿色") &&
                        product.getCertificationJson().contains("绿色")) {
                    score += 0.1;
                }
                if (demand.getCertificationRequire().contains("有机") &&
                        product.getCertificationJson().contains("有机")) {
                    score += 0.1;
                }
                if (demand.getCertificationRequire().contains("地理标志") &&
                        product.getCertificationJson().contains("地理标志")) {
                    score += 0.1;
                }
            }
        }

        return Math.min(score, 1.0);
    }

    private double calculateReputationScore(TradeProduct product) {
        return 0.7;
    }

    private double calculatePreferenceScore(Demand demand, TradeProduct product) {
        return 0.5;
    }

    private String getMatchLevel(BigDecimal score) {
        double scoreValue = score.doubleValue();
        if (scoreValue >= 80) return "高度匹配";
        if (scoreValue >= 60) return "相关匹配";
        return "参考匹配";
    }

    private String generateMatchReason(Map<String, Double> dimensionScores) {
        List<String> reasons = new ArrayList<>();

        if (dimensionScores.getOrDefault("category", 0.0) >= 0.8) {
            reasons.add("品类匹配度高");
        }
        if (dimensionScores.getOrDefault("price", 0.0) >= 0.8) {
            reasons.add("价格符合预期");
        }
        if (dimensionScores.getOrDefault("distance", 0.0) >= 0.8) {
            reasons.add("产地距离较近，物流成本较低");
        }
        if (dimensionScores.getOrDefault("quality", 0.0) >= 0.7) {
            reasons.add("品质等级符合要求");
        }
        if (dimensionScores.getOrDefault("reputation", 0.0) >= 0.7) {
            reasons.add("供应商信誉良好");
        }

        if (reasons.isEmpty()) {
            reasons.add("综合匹配度适中");
        }

        return String.join("，", reasons);
    }

    private List<TradeProduct> findCandidateProducts(Demand demand) {
        LambdaQueryWrapper<TradeProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProduct::getDelFlag, 0);
        wrapper.eq(TradeProduct::getStatus, 1);
        wrapper.eq(TradeProduct::getPublishStatus, "published");

        if (demand.getCategoryId() != null) {
            wrapper.eq(TradeProduct::getCategoryId, demand.getCategoryId());
        }

        if (demand.getVariety() != null && !demand.getVariety().isEmpty()) {
            wrapper.like(TradeProduct::getVariety, demand.getVariety());
        }

        if (demand.getQuantity() != null) {
            wrapper.ge(TradeProduct::getStockQuantity, demand.getQuantity());
        }

        wrapper.orderByDesc(TradeProduct::getCreateTime);

        return productMapper.selectList(wrapper);
    }

    private List<Demand> findCandidateDemands(TradeProduct product) {
        LambdaQueryWrapper<Demand> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Demand::getDelFlag, 0);
        wrapper.eq(Demand::getDemandStatus, "publish");

        if (product.getCategoryId() != null) {
            wrapper.eq(Demand::getCategoryId, product.getCategoryId());
        }

        if (product.getVariety() != null && !product.getVariety().isEmpty()) {
            wrapper.like(Demand::getVariety, product.getVariety());
        }

        wrapper.orderByDesc(Demand::getCreateTime);

        return demandMapper.selectList(wrapper);
    }

    @Override
    @Transactional
    public List<MatchRecord> batchCreateMatchRecords(Long demandId, List<Long> productIds) {
        Demand demand = demandMapper.selectById(demandId);
        if (demand == null) {
            return Collections.emptyList();
        }

        List<MatchRecord> records = new ArrayList<>();
        int order = 1;

        for (Long productId : productIds) {
            TradeProduct product = productMapper.selectById(productId);
            if (product == null) continue;

            MatchResultVO result = calculateMatchScore(demand, product);

            MatchRecord record = new MatchRecord();
            record.setMatchNo("MT" + System.currentTimeMillis() + "-" + order);
            record.setDemandId(demandId);
            record.setProductId(productId);
            record.setMatchType("demand_to_product");
            record.setMatchScore(result.getMatchScore());
            record.setCategoryScore(result.getCategoryScore());
            record.setPriceScore(result.getPriceScore());
            record.setDistanceScore(result.getDistanceScore());
            record.setQualityScore(result.getQualityScore());
            record.setMatchReason(result.getMatchReason());
            record.setRecommendOrder(order);
            record.setDelFlag(0);
            record.setCreateTime(new Date());

            records.add(record);
            order++;
        }

        if (!records.isEmpty()) {
            matchRecordMapper.insertBatch(records);
        }

        return records;
    }

    @Override
    public void updateMatchScore(Long matchRecordId, Double newScore) {
        MatchRecord record = matchRecordMapper.selectById(matchRecordId);
        if (record != null) {
            record.setMatchScore(BigDecimal.valueOf(newScore));
            matchRecordMapper.updateById(record);
        }
    }

    @Override
    public List<MatchRecord> getMatchRecordsByDemand(Long demandId) {
        LambdaQueryWrapper<MatchRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MatchRecord::getDemandId, demandId);
        wrapper.eq(MatchRecord::getDelFlag, 0);
        wrapper.orderByDesc(MatchRecord::getMatchScore);
        return matchRecordMapper.selectList(wrapper);
    }

    @Override
    public List<MatchRecord> getMatchRecordsByProduct(Long productId) {
        LambdaQueryWrapper<MatchRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MatchRecord::getProductId, productId);
        wrapper.eq(MatchRecord::getDelFlag, 0);
        wrapper.orderByDesc(MatchRecord::getMatchScore);
        return matchRecordMapper.selectList(wrapper);
    }
}