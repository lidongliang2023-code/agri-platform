package com.agri.trade.service.impl;

import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.service.IPriceService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class PriceServiceImpl implements IPriceService {

    private final TradeProductMapper productMapper;
    private final Random random = new Random();

    private static final Map<String, BigDecimal> BASE_PRICES = new HashMap<>();
    static {
        BASE_PRICES.put("玉米", new BigDecimal("2800"));
        BASE_PRICES.put("小麦", new BigDecimal("3100"));
        BASE_PRICES.put("水稻", new BigDecimal("2900"));
        BASE_PRICES.put("大豆", new BigDecimal("4500"));
        BASE_PRICES.put("棉花", new BigDecimal("15000"));
        BASE_PRICES.put("蔬菜", new BigDecimal("5000"));
        BASE_PRICES.put("水果", new BigDecimal("8000"));
        BASE_PRICES.put("猪肉", new BigDecimal("25000"));
        BASE_PRICES.put("牛肉", new BigDecimal("60000"));
        BASE_PRICES.put("鸡蛋", new BigDecimal("8500"));
        BASE_PRICES.put("牛奶", new BigDecimal("4500"));
        BASE_PRICES.put("化肥", new BigDecimal("3200"));
        BASE_PRICES.put("农药", new BigDecimal("12000"));
        BASE_PRICES.put("种子", new BigDecimal("15000"));
        BASE_PRICES.put("饲料", new BigDecimal("3000"));
    }

    @Override
    public PriceRecommendation getPriceRecommendation(Long productId) {
        TradeProduct product = productMapper.selectById(productId);
        if (product == null) {
            return null;
        }
        return buildRecommendation(product);
    }

    @Override
    public PriceRecommendation getPriceRecommendationByCategory(String categoryCode) {
        LambdaQueryWrapper<TradeProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProduct::getCategoryCode, categoryCode);
        wrapper.eq(TradeProduct::getDelFlag, 0);
        List<TradeProduct> products = productMapper.selectList(wrapper);
        
        if (products.isEmpty()) {
            return null;
        }
        
        TradeProduct sampleProduct = products.get(0);
        return buildRecommendation(sampleProduct);
    }

    @Override
    public List<PriceTrend> getPriceTrend(Long productId, int days) {
        TradeProduct product = productMapper.selectById(productId);
        if (product == null) {
            return new ArrayList<>();
        }
        return generatePriceTrend(product.getProductName(), days);
    }

    @Override
    public List<PriceTrend> getCategoryPriceTrend(String categoryCode, int days) {
        return generatePriceTrend(getCategoryName(categoryCode), days);
    }

    @Override
    public IPriceService.MarketPrice getMarketPrice(String productName) {
        BigDecimal basePrice = BASE_PRICES.getOrDefault(productName, new BigDecimal("5000"));
        BigDecimal currentPrice = basePrice.multiply(BigDecimal.valueOf(0.9 + random.nextDouble() * 0.2));
        
        IPriceService.MarketPrice marketPrice = new IPriceService.MarketPrice();
        marketPrice.setProductName(productName);
        marketPrice.setCurrentPrice(currentPrice.setScale(2, RoundingMode.HALF_UP));
        marketPrice.setYesterdayPrice(basePrice);
        BigDecimal change = currentPrice.subtract(basePrice);
        marketPrice.setChange(change.setScale(2, RoundingMode.HALF_UP));
        marketPrice.setChangePercent(change.divide(basePrice, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP));
        marketPrice.setUnit("元/吨");
        marketPrice.setSource("全国农产品交易中心");
        marketPrice.setUpdateTime(LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        
        return marketPrice;
    }

    @Override
    public List<IPriceService.MarketPrice> getMarketPricesByCategory(String categoryCode) {
        List<IPriceService.MarketPrice> prices = new ArrayList<>();
        
        List<String> products = getProductsByCategory(categoryCode);
        for (String product : products) {
            prices.add(getMarketPrice(product));
        }
        
        return prices;
    }

    @Override
    public BigDecimal calculateRecommendedPrice(Long productId) {
        TradeProduct product = productMapper.selectById(productId);
        if (product == null) {
            return BigDecimal.ZERO;
        }
        
        BigDecimal basePrice = BASE_PRICES.getOrDefault(product.getProductName(), new BigDecimal("5000"));
        BigDecimal qualityFactor = getQualityFactor(product.getQualityLevel());
        BigDecimal supplyFactor = getSupplyFactor(product.getStockQuantity());
        
        return basePrice.multiply(qualityFactor).multiply(supplyFactor).setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public Map<String, BigDecimal> getPriceRange(String categoryCode) {
        List<String> products = getProductsByCategory(categoryCode);
        
        BigDecimal min = BigDecimal.valueOf(Long.MAX_VALUE);
        BigDecimal max = BigDecimal.ZERO;
        
        for (String product : products) {
            BigDecimal price = BASE_PRICES.getOrDefault(product, new BigDecimal("5000"));
            if (price.compareTo(min) < 0) min = price;
            if (price.compareTo(max) > 0) max = price;
        }
        
        Map<String, BigDecimal> range = new HashMap<>();
        range.put("min", min);
        range.put("max", max);
        range.put("average", min.add(max).divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP));
        
        return range;
    }

    @Override
    public BigDecimal getMarketAveragePrice(String categoryCode) {
        List<String> products = getProductsByCategory(categoryCode);
        
        if (products.isEmpty()) {
            return BigDecimal.ZERO;
        }
        
        BigDecimal sum = BigDecimal.ZERO;
        for (String product : products) {
            sum = sum.add(BASE_PRICES.getOrDefault(product, new BigDecimal("5000")));
        }
        
        return sum.divide(BigDecimal.valueOf(products.size()), 2, RoundingMode.HALF_UP);
    }

    private IPriceService.PriceRecommendation buildRecommendation(TradeProduct product) {
        IPriceService.PriceRecommendation recommendation = new IPriceService.PriceRecommendation();
        recommendation.setProductId(product.getId());
        recommendation.setProductName(product.getProductName());
        
        BigDecimal marketAverage = BASE_PRICES.getOrDefault(product.getProductName(), new BigDecimal("5000"));
        recommendation.setMarketAverage(marketAverage);
        
        BigDecimal minPrice = marketAverage.multiply(new BigDecimal("0.85"));
        BigDecimal maxPrice = marketAverage.multiply(new BigDecimal("1.15"));
        recommendation.setMinPrice(minPrice.setScale(2, RoundingMode.HALF_UP));
        recommendation.setMaxPrice(maxPrice.setScale(2, RoundingMode.HALF_UP));
        
        BigDecimal recommendedPrice = calculateRecommendedPrice(product.getId());
        recommendation.setRecommendedPrice(recommendedPrice);
        
        recommendation.setPriceLevel(getPriceLevel(recommendedPrice, marketAverage));
        recommendation.setRecommendationReason(generateRecommendationReason(product, recommendedPrice, marketAverage));
        recommendation.setTrend(getTrend());
        recommendation.setRecentTrends(generatePriceTrend(product.getProductName(), 7));
        
        return recommendation;
    }

    private List<IPriceService.PriceTrend> generatePriceTrend(String productName, int days) {
        List<IPriceService.PriceTrend> trends = new ArrayList<>();
        BigDecimal basePrice = BASE_PRICES.getOrDefault(productName, new BigDecimal("5000"));
        BigDecimal previousPrice = basePrice;
        
        LocalDate today = LocalDate.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        
        for (int i = days - 1; i >= 0; i--) {
            String date = today.minusDays(i).format(formatter);
            BigDecimal price = basePrice.multiply(BigDecimal.valueOf(0.95 + random.nextDouble() * 0.1));
            BigDecimal change = price.subtract(previousPrice);
            BigDecimal changePercent = previousPrice.compareTo(BigDecimal.ZERO) > 0 
                ? change.divide(previousPrice, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
            
            trends.add(new IPriceService.PriceTrend(date, price.setScale(2, RoundingMode.HALF_UP), 
                change.setScale(2, RoundingMode.HALF_UP), changePercent.setScale(2, RoundingMode.HALF_UP)));
            previousPrice = price;
        }
        
        return trends;
    }

    private BigDecimal getQualityFactor(String qualityLevel) {
        return switch (qualityLevel) {
            case "premium" -> new BigDecimal("1.2");
            case "high" -> new BigDecimal("1.1");
            case "normal" -> new BigDecimal("1.0");
            case "low" -> new BigDecimal("0.9");
            default -> new BigDecimal("1.0");
        };
    }

    private BigDecimal getSupplyFactor(BigDecimal stockQuantity) {
        if (stockQuantity == null || stockQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            return new BigDecimal("1.1");
        } else if (stockQuantity.compareTo(new BigDecimal("100")) > 0) {
            return new BigDecimal("0.95");
        } else if (stockQuantity.compareTo(new BigDecimal("50")) > 0) {
            return new BigDecimal("0.98");
        }
        return new BigDecimal("1.0");
    }

    private String getPriceLevel(BigDecimal price, BigDecimal marketAverage) {
        double ratio = price.divide(marketAverage, 4, RoundingMode.HALF_UP).doubleValue();
        if (ratio < 0.9) return "low";
        if (ratio < 1.1) return "normal";
        return "high";
    }

    private String generateRecommendationReason(TradeProduct product, BigDecimal price, BigDecimal marketAverage) {
        StringBuilder reason = new StringBuilder("根据市场行情分析：");
        
        if (price.compareTo(marketAverage) < 0) {
            reason.append("当前价格低于市场平均水平，具有竞争力。");
        } else if (price.compareTo(marketAverage) > 0) {
            reason.append("当前价格高于市场平均水平，建议关注市场动态。");
        } else {
            reason.append("当前价格处于市场平均水平。");
        }
        
        if ("premium".equals(product.getQualityLevel())) {
            reason.append("商品质量为优质等级，价格合理。");
        }
        
        if (product.getStockQuantity() != null && product.getStockQuantity().compareTo(new BigDecimal("100")) > 0) {
            reason.append("库存充足，供货稳定。");
        }
        
        return reason.toString();
    }

    private String getTrend() {
        double rand = random.nextDouble();
        if (rand < 0.3) return "down";
        if (rand < 0.6) return "stable";
        return "up";
    }

    private String getCategoryName(String categoryCode) {
        return switch (categoryCode) {
            case "grain" -> "玉米";
            case "vegetable" -> "蔬菜";
            case "livestock" -> "猪肉";
            case "agri_input" -> "化肥";
            default -> "蔬菜";
        };
    }

    private List<String> getProductsByCategory(String categoryCode) {
        return switch (categoryCode) {
            case "grain" -> List.of("玉米", "小麦", "水稻", "大豆");
            case "vegetable" -> List.of("蔬菜", "水果");
            case "livestock" -> List.of("猪肉", "牛肉", "鸡蛋", "牛奶");
            case "agri_input" -> List.of("化肥", "农药", "种子", "饲料");
            default -> List.of("玉米", "小麦", "蔬菜");
        };
    }
}