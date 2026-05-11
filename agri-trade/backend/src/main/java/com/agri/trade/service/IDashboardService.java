package com.agri.trade.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public interface IDashboardService {

    SellerDashboard getSellerDashboard(Long sellerId);

    BuyerDashboard getBuyerDashboard(Long buyerId);

    Map<String, Object> getTransactionStats(Long userId, String userType);

    List<TransactionTrend> getTransactionTrend(Long userId, String userType, int days);

    List<TopProduct> getTopProducts(Long sellerId, int limit);

    List<TopBuyer> getTopBuyers(Long sellerId, int limit);

    List<OrderStatusStats> getOrderStatusDistribution(Long userId, String userType);

    static class SellerDashboard {
        private Long sellerId;
        private String sellerName;
        private BigDecimal totalRevenue;
        private BigDecimal todayRevenue;
        private Integer totalOrders;
        private Integer todayOrders;
        private Integer pendingOrders;
        private Integer completedOrders;
        private BigDecimal avgOrderValue;
        private BigDecimal avgRating;
        private Integer productCount;
        private Integer activeProducts;
        private List<TransactionTrend> revenueTrend;
        private List<TopProduct> topProducts;
        private List<OrderStatusStats> orderStatusDistribution;

        public Long getSellerId() { return sellerId; }
        public void setSellerId(Long sellerId) { this.sellerId = sellerId; }
        public String getSellerName() { return sellerName; }
        public void setSellerName(String sellerName) { this.sellerName = sellerName; }
        public BigDecimal getTotalRevenue() { return totalRevenue; }
        public void setTotalRevenue(BigDecimal totalRevenue) { this.totalRevenue = totalRevenue; }
        public BigDecimal getTodayRevenue() { return todayRevenue; }
        public void setTodayRevenue(BigDecimal todayRevenue) { this.todayRevenue = todayRevenue; }
        public Integer getTotalOrders() { return totalOrders; }
        public void setTotalOrders(Integer totalOrders) { this.totalOrders = totalOrders; }
        public Integer getTodayOrders() { return todayOrders; }
        public void setTodayOrders(Integer todayOrders) { this.todayOrders = todayOrders; }
        public Integer getPendingOrders() { return pendingOrders; }
        public void setPendingOrders(Integer pendingOrders) { this.pendingOrders = pendingOrders; }
        public Integer getCompletedOrders() { return completedOrders; }
        public void setCompletedOrders(Integer completedOrders) { this.completedOrders = completedOrders; }
        public BigDecimal getAvgOrderValue() { return avgOrderValue; }
        public void setAvgOrderValue(BigDecimal avgOrderValue) { this.avgOrderValue = avgOrderValue; }
        public BigDecimal getAvgRating() { return avgRating; }
        public void setAvgRating(BigDecimal avgRating) { this.avgRating = avgRating; }
        public Integer getProductCount() { return productCount; }
        public void setProductCount(Integer productCount) { this.productCount = productCount; }
        public Integer getActiveProducts() { return activeProducts; }
        public void setActiveProducts(Integer activeProducts) { this.activeProducts = activeProducts; }
        public List<TransactionTrend> getRevenueTrend() { return revenueTrend; }
        public void setRevenueTrend(List<TransactionTrend> revenueTrend) { this.revenueTrend = revenueTrend; }
        public List<TopProduct> getTopProducts() { return topProducts; }
        public void setTopProducts(List<TopProduct> topProducts) { this.topProducts = topProducts; }
        public List<OrderStatusStats> getOrderStatusDistribution() { return orderStatusDistribution; }
        public void setOrderStatusDistribution(List<OrderStatusStats> orderStatusDistribution) { this.orderStatusDistribution = orderStatusDistribution; }
    }

    static class BuyerDashboard {
        private Long buyerId;
        private String buyerName;
        private BigDecimal totalSpent;
        private BigDecimal todaySpent;
        private Integer totalOrders;
        private Integer todayOrders;
        private Integer pendingOrders;
        private Integer completedOrders;
        private BigDecimal avgOrderValue;
        private Integer favoriteSellers;
        private Integer followedProducts;
        private List<TransactionTrend> spendingTrend;
        private List<TopBuyer.PurchaseCategory> purchaseCategories;
        private List<OrderStatusStats> orderStatusDistribution;

        public Long getBuyerId() { return buyerId; }
        public void setBuyerId(Long buyerId) { this.buyerId = buyerId; }
        public String getBuyerName() { return buyerName; }
        public void setBuyerName(String buyerName) { this.buyerName = buyerName; }
        public BigDecimal getTotalSpent() { return totalSpent; }
        public void setTotalSpent(BigDecimal totalSpent) { this.totalSpent = totalSpent; }
        public BigDecimal getTodaySpent() { return todaySpent; }
        public void setTodaySpent(BigDecimal todaySpent) { this.todaySpent = todaySpent; }
        public Integer getTotalOrders() { return totalOrders; }
        public void setTotalOrders(Integer totalOrders) { this.totalOrders = totalOrders; }
        public Integer getTodayOrders() { return todayOrders; }
        public void setTodayOrders(Integer todayOrders) { this.todayOrders = todayOrders; }
        public Integer getPendingOrders() { return pendingOrders; }
        public void setPendingOrders(Integer pendingOrders) { this.pendingOrders = pendingOrders; }
        public Integer getCompletedOrders() { return completedOrders; }
        public void setCompletedOrders(Integer completedOrders) { this.completedOrders = completedOrders; }
        public BigDecimal getAvgOrderValue() { return avgOrderValue; }
        public void setAvgOrderValue(BigDecimal avgOrderValue) { this.avgOrderValue = avgOrderValue; }
        public Integer getFavoriteSellers() { return favoriteSellers; }
        public void setFavoriteSellers(Integer favoriteSellers) { this.favoriteSellers = favoriteSellers; }
        public Integer getFollowedProducts() { return followedProducts; }
        public void setFollowedProducts(Integer followedProducts) { this.followedProducts = followedProducts; }
        public List<TransactionTrend> getSpendingTrend() { return spendingTrend; }
        public void setSpendingTrend(List<TransactionTrend> spendingTrend) { this.spendingTrend = spendingTrend; }
        public List<TopBuyer.PurchaseCategory> getPurchaseCategories() { return purchaseCategories; }
        public void setPurchaseCategories(List<TopBuyer.PurchaseCategory> purchaseCategories) { this.purchaseCategories = purchaseCategories; }
        public List<OrderStatusStats> getOrderStatusDistribution() { return orderStatusDistribution; }
        public void setOrderStatusDistribution(List<OrderStatusStats> orderStatusDistribution) { this.orderStatusDistribution = orderStatusDistribution; }
    }

    static class TransactionTrend {
        private String date;
        private BigDecimal amount;
        private Integer orderCount;

        public TransactionTrend() {}
        public TransactionTrend(String date, BigDecimal amount, Integer orderCount) {
            this.date = date;
            this.amount = amount;
            this.orderCount = orderCount;
        }

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }
        public BigDecimal getAmount() { return amount; }
        public void setAmount(BigDecimal amount) { this.amount = amount; }
        public Integer getOrderCount() { return orderCount; }
        public void setOrderCount(Integer orderCount) { this.orderCount = orderCount; }
    }

    static class TopProduct {
        private Long productId;
        private String productName;
        private BigDecimal totalSales;
        private Integer salesCount;
        private BigDecimal avgPrice;

        public Long getProductId() { return productId; }
        public void setProductId(Long productId) { this.productId = productId; }
        public String getProductName() { return productName; }
        public void setProductName(String productName) { this.productName = productName; }
        public BigDecimal getTotalSales() { return totalSales; }
        public void setTotalSales(BigDecimal totalSales) { this.totalSales = totalSales; }
        public Integer getSalesCount() { return salesCount; }
        public void setSalesCount(Integer salesCount) { this.salesCount = salesCount; }
        public BigDecimal getAvgPrice() { return avgPrice; }
        public void setAvgPrice(BigDecimal avgPrice) { this.avgPrice = avgPrice; }
    }

    static class TopBuyer {
        private Long buyerId;
        private String buyerName;
        private BigDecimal totalPurchase;
        private Integer purchaseCount;

        public Long getBuyerId() { return buyerId; }
        public void setBuyerId(Long buyerId) { this.buyerId = buyerId; }
        public String getBuyerName() { return buyerName; }
        public void setBuyerName(String buyerName) { this.buyerName = buyerName; }
        public BigDecimal getTotalPurchase() { return totalPurchase; }
        public void setTotalPurchase(BigDecimal totalPurchase) { this.totalPurchase = totalPurchase; }
        public Integer getPurchaseCount() { return purchaseCount; }
        public void setPurchaseCount(Integer purchaseCount) { this.purchaseCount = purchaseCount; }

        public static class PurchaseCategory {
            private String categoryCode;
            private String categoryName;
            private BigDecimal totalAmount;
            private Integer orderCount;

            public String getCategoryCode() { return categoryCode; }
            public void setCategoryCode(String categoryCode) { this.categoryCode = categoryCode; }
            public String getCategoryName() { return categoryName; }
            public void setCategoryName(String categoryName) { this.categoryName = categoryName; }
            public BigDecimal getTotalAmount() { return totalAmount; }
            public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
            public Integer getOrderCount() { return orderCount; }
            public void setOrderCount(Integer orderCount) { this.orderCount = orderCount; }
        }
    }

    static class OrderStatusStats {
        private String status;
        private String statusName;
        private Integer count;
        private BigDecimal amount;

        public OrderStatusStats() {}
        public OrderStatusStats(String status, String statusName, Integer count, BigDecimal amount) {
            this.status = status;
            this.statusName = statusName;
            this.count = count;
            this.amount = amount;
        }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getStatusName() { return statusName; }
        public void setStatusName(String statusName) { this.statusName = statusName; }
        public Integer getCount() { return count; }
        public void setCount(Integer count) { this.count = count; }
        public BigDecimal getAmount() { return amount; }
        public void setAmount(BigDecimal amount) { this.amount = amount; }
    }
}