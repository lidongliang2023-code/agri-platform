package com.agri.trade.service;

import com.agri.trade.entity.TradeProduct;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public interface IPriceService {

    PriceRecommendation getPriceRecommendation(Long productId);

    PriceRecommendation getPriceRecommendationByCategory(String categoryCode);

    List<PriceTrend> getPriceTrend(Long productId, int days);

    List<PriceTrend> getCategoryPriceTrend(String categoryCode, int days);

    MarketPrice getMarketPrice(String productName);

    List<MarketPrice> getMarketPricesByCategory(String categoryCode);

    BigDecimal calculateRecommendedPrice(Long productId);

    Map<String, BigDecimal> getPriceRange(String categoryCode);

    BigDecimal getMarketAveragePrice(String categoryCode);

    static class PriceRecommendation {
        private Long productId;
        private String productName;
        private BigDecimal recommendedPrice;
        private BigDecimal marketAverage;
        private BigDecimal minPrice;
        private BigDecimal maxPrice;
        private String priceLevel;
        private String recommendationReason;
        private String trend;
        private List<PriceTrend> recentTrends;

        public Long getProductId() { return productId; }
        public void setProductId(Long productId) { this.productId = productId; }
        public String getProductName() { return productName; }
        public void setProductName(String productName) { this.productName = productName; }
        public BigDecimal getRecommendedPrice() { return recommendedPrice; }
        public void setRecommendedPrice(BigDecimal recommendedPrice) { this.recommendedPrice = recommendedPrice; }
        public BigDecimal getMarketAverage() { return marketAverage; }
        public void setMarketAverage(BigDecimal marketAverage) { this.marketAverage = marketAverage; }
        public BigDecimal getMinPrice() { return minPrice; }
        public void setMinPrice(BigDecimal minPrice) { this.minPrice = minPrice; }
        public BigDecimal getMaxPrice() { return maxPrice; }
        public void setMaxPrice(BigDecimal maxPrice) { this.maxPrice = maxPrice; }
        public String getPriceLevel() { return priceLevel; }
        public void setPriceLevel(String priceLevel) { this.priceLevel = priceLevel; }
        public String getRecommendationReason() { return recommendationReason; }
        public void setRecommendationReason(String recommendationReason) { this.recommendationReason = recommendationReason; }
        public String getTrend() { return trend; }
        public void setTrend(String trend) { this.trend = trend; }
        public List<PriceTrend> getRecentTrends() { return recentTrends; }
        public void setRecentTrends(List<PriceTrend> recentTrends) { this.recentTrends = recentTrends; }
    }

    static class PriceTrend {
        private String date;
        private BigDecimal price;
        private BigDecimal change;
        private BigDecimal changePercent;

        public PriceTrend() {}
        public PriceTrend(String date, BigDecimal price, BigDecimal change, BigDecimal changePercent) {
            this.date = date;
            this.price = price;
            this.change = change;
            this.changePercent = changePercent;
        }

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }
        public BigDecimal getPrice() { return price; }
        public void setPrice(BigDecimal price) { this.price = price; }
        public BigDecimal getChange() { return change; }
        public void setChange(BigDecimal change) { this.change = change; }
        public BigDecimal getChangePercent() { return changePercent; }
        public void setChangePercent(BigDecimal changePercent) { this.changePercent = changePercent; }
    }

    static class MarketPrice {
        private String productName;
        private String categoryCode;
        private BigDecimal currentPrice;
        private BigDecimal yesterdayPrice;
        private BigDecimal change;
        private BigDecimal changePercent;
        private String unit;
        private String source;
        private String updateTime;

        public String getProductName() { return productName; }
        public void setProductName(String productName) { this.productName = productName; }
        public String getCategoryCode() { return categoryCode; }
        public void setCategoryCode(String categoryCode) { this.categoryCode = categoryCode; }
        public BigDecimal getCurrentPrice() { return currentPrice; }
        public void setCurrentPrice(BigDecimal currentPrice) { this.currentPrice = currentPrice; }
        public BigDecimal getYesterdayPrice() { return yesterdayPrice; }
        public void setYesterdayPrice(BigDecimal yesterdayPrice) { this.yesterdayPrice = yesterdayPrice; }
        public BigDecimal getChange() { return change; }
        public void setChange(BigDecimal change) { this.change = change; }
        public BigDecimal getChangePercent() { return changePercent; }
        public void setChangePercent(BigDecimal changePercent) { this.changePercent = changePercent; }
        public String getUnit() { return unit; }
        public void setUnit(String unit) { this.unit = unit; }
        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }
        public String getUpdateTime() { return updateTime; }
        public void setUpdateTime(String updateTime) { this.updateTime = updateTime; }
    }
}