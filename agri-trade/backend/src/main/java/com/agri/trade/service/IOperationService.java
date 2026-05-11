package com.agri.trade.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public interface IOperationService {

    OperationDashboard getOperationDashboard();

    TransactionOverview getTransactionOverview(int days);

    List<CategoryStats> getCategoryStats();

    List<RegionStats> getRegionStats();

    List<RiskAlert> getRiskAlerts();

    RiskAlert getRiskAlert(Long alertId);

    boolean handleRiskAlert(Long alertId, String handleResult, String handleRemark);

    List<RiskRule> getRiskRules();

    RiskRule addRiskRule(RiskRule rule);

    boolean updateRiskRule(RiskRule rule);

    boolean deleteRiskRule(Long ruleId);

    Map<String, Object> getSystemHealth();

    static class OperationDashboard {
        private BigDecimal totalTransactionAmount;
        private Integer totalTransactionCount;
        private BigDecimal todayTransactionAmount;
        private Integer todayTransactionCount;
        private BigDecimal transactionAmountGrowth;
        private BigDecimal transactionCountGrowth;
        private Integer activeSellers;
        private Integer activeBuyers;
        private Integer pendingOrders;
        private Integer completedOrders;
        private Integer riskAlertCount;
        private List<TransactionOverview.TransactionTrend> recentTrend;
        private List<CategoryStats> categoryTopList;
        private List<RegionStats> regionTopList;

        public BigDecimal getTotalTransactionAmount() { return totalTransactionAmount; }
        public void setTotalTransactionAmount(BigDecimal totalTransactionAmount) { this.totalTransactionAmount = totalTransactionAmount; }
        public Integer getTotalTransactionCount() { return totalTransactionCount; }
        public void setTotalTransactionCount(Integer totalTransactionCount) { this.totalTransactionCount = totalTransactionCount; }
        public BigDecimal getTodayTransactionAmount() { return todayTransactionAmount; }
        public void setTodayTransactionAmount(BigDecimal todayTransactionAmount) { this.todayTransactionAmount = todayTransactionAmount; }
        public Integer getTodayTransactionCount() { return todayTransactionCount; }
        public void setTodayTransactionCount(Integer todayTransactionCount) { this.todayTransactionCount = todayTransactionCount; }
        public BigDecimal getTransactionAmountGrowth() { return transactionAmountGrowth; }
        public void setTransactionAmountGrowth(BigDecimal transactionAmountGrowth) { this.transactionAmountGrowth = transactionAmountGrowth; }
        public BigDecimal getTransactionCountGrowth() { return transactionCountGrowth; }
        public void setTransactionCountGrowth(BigDecimal transactionCountGrowth) { this.transactionCountGrowth = transactionCountGrowth; }
        public Integer getActiveSellers() { return activeSellers; }
        public void setActiveSellers(Integer activeSellers) { this.activeSellers = activeSellers; }
        public Integer getActiveBuyers() { return activeBuyers; }
        public void setActiveBuyers(Integer activeBuyers) { this.activeBuyers = activeBuyers; }
        public Integer getPendingOrders() { return pendingOrders; }
        public void setPendingOrders(Integer pendingOrders) { this.pendingOrders = pendingOrders; }
        public Integer getCompletedOrders() { return completedOrders; }
        public void setCompletedOrders(Integer completedOrders) { this.completedOrders = completedOrders; }
        public Integer getRiskAlertCount() { return riskAlertCount; }
        public void setRiskAlertCount(Integer riskAlertCount) { this.riskAlertCount = riskAlertCount; }
        public List<TransactionOverview.TransactionTrend> getRecentTrend() { return recentTrend; }
        public void setRecentTrend(List<TransactionOverview.TransactionTrend> recentTrend) { this.recentTrend = recentTrend; }
        public List<CategoryStats> getCategoryTopList() { return categoryTopList; }
        public void setCategoryTopList(List<CategoryStats> categoryTopList) { this.categoryTopList = categoryTopList; }
        public List<RegionStats> getRegionTopList() { return regionTopList; }
        public void setRegionTopList(List<RegionStats> regionTopList) { this.regionTopList = regionTopList; }
    }

    static class TransactionOverview {
        private String period;
        private BigDecimal totalAmount;
        private Integer totalOrders;
        private BigDecimal avgOrderValue;
        private Integer activeUsers;
        private List<TransactionTrend> trends;

        public String getPeriod() { return period; }
        public void setPeriod(String period) { this.period = period; }
        public BigDecimal getTotalAmount() { return totalAmount; }
        public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
        public Integer getTotalOrders() { return totalOrders; }
        public void setTotalOrders(Integer totalOrders) { this.totalOrders = totalOrders; }
        public BigDecimal getAvgOrderValue() { return avgOrderValue; }
        public void setAvgOrderValue(BigDecimal avgOrderValue) { this.avgOrderValue = avgOrderValue; }
        public Integer getActiveUsers() { return activeUsers; }
        public void setActiveUsers(Integer activeUsers) { this.activeUsers = activeUsers; }
        public List<TransactionTrend> getTrends() { return trends; }
        public void setTrends(List<TransactionTrend> trends) { this.trends = trends; }

        public static class TransactionTrend {
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
    }

    static class CategoryStats {
        private String categoryCode;
        private String categoryName;
        private BigDecimal totalAmount;
        private Integer orderCount;
        private BigDecimal growthRate;

        public String getCategoryCode() { return categoryCode; }
        public void setCategoryCode(String categoryCode) { this.categoryCode = categoryCode; }
        public String getCategoryName() { return categoryName; }
        public void setCategoryName(String categoryName) { this.categoryName = categoryName; }
        public BigDecimal getTotalAmount() { return totalAmount; }
        public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
        public Integer getOrderCount() { return orderCount; }
        public void setOrderCount(Integer orderCount) { this.orderCount = orderCount; }
        public BigDecimal getGrowthRate() { return growthRate; }
        public void setGrowthRate(BigDecimal growthRate) { this.growthRate = growthRate; }
    }

    static class RegionStats {
        private String regionCode;
        private String regionName;
        private BigDecimal totalAmount;
        private Integer orderCount;
        private Integer sellerCount;
        private Integer buyerCount;

        public String getRegionCode() { return regionCode; }
        public void setRegionCode(String regionCode) { this.regionCode = regionCode; }
        public String getRegionName() { return regionName; }
        public void setRegionName(String regionName) { this.regionName = regionName; }
        public BigDecimal getTotalAmount() { return totalAmount; }
        public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
        public Integer getOrderCount() { return orderCount; }
        public void setOrderCount(Integer orderCount) { this.orderCount = orderCount; }
        public Integer getSellerCount() { return sellerCount; }
        public void setSellerCount(Integer sellerCount) { this.sellerCount = sellerCount; }
        public Integer getBuyerCount() { return buyerCount; }
        public void setBuyerCount(Integer buyerCount) { this.buyerCount = buyerCount; }
    }

    static class RiskAlert {
        private Long id;
        private String alertType;
        private String alertLevel;
        private String alertTitle;
        private String alertContent;
        private Long relatedId;
        private String relatedType;
        private String status;
        private String handleResult;
        private String handleRemark;
        private String handleBy;
        private java.util.Date handleTime;
        private java.util.Date createTime;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getAlertType() { return alertType; }
        public void setAlertType(String alertType) { this.alertType = alertType; }
        public String getAlertLevel() { return alertLevel; }
        public void setAlertLevel(String alertLevel) { this.alertLevel = alertLevel; }
        public String getAlertTitle() { return alertTitle; }
        public void setAlertTitle(String alertTitle) { this.alertTitle = alertTitle; }
        public String getAlertContent() { return alertContent; }
        public void setAlertContent(String alertContent) { this.alertContent = alertContent; }
        public Long getRelatedId() { return relatedId; }
        public void setRelatedId(Long relatedId) { this.relatedId = relatedId; }
        public String getRelatedType() { return relatedType; }
        public void setRelatedType(String relatedType) { this.relatedType = relatedType; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getHandleResult() { return handleResult; }
        public void setHandleResult(String handleResult) { this.handleResult = handleResult; }
        public String getHandleRemark() { return handleRemark; }
        public void setHandleRemark(String handleRemark) { this.handleRemark = handleRemark; }
        public String getHandleBy() { return handleBy; }
        public void setHandleBy(String handleBy) { this.handleBy = handleBy; }
        public java.util.Date getHandleTime() { return handleTime; }
        public void setHandleTime(java.util.Date handleTime) { this.handleTime = handleTime; }
        public java.util.Date getCreateTime() { return createTime; }
        public void setCreateTime(java.util.Date createTime) { this.createTime = createTime; }
    }

    static class RiskRule {
        private Long id;
        private String ruleCode;
        private String ruleName;
        private String ruleType;
        private String ruleExpression;
        private String alertLevel;
        private Integer status;
        private String description;
        private java.util.Date createTime;
        private java.util.Date updateTime;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getRuleCode() { return ruleCode; }
        public void setRuleCode(String ruleCode) { this.ruleCode = ruleCode; }
        public String getRuleName() { return ruleName; }
        public void setRuleName(String ruleName) { this.ruleName = ruleName; }
        public String getRuleType() { return ruleType; }
        public void setRuleType(String ruleType) { this.ruleType = ruleType; }
        public String getRuleExpression() { return ruleExpression; }
        public void setRuleExpression(String ruleExpression) { this.ruleExpression = ruleExpression; }
        public String getAlertLevel() { return alertLevel; }
        public void setAlertLevel(String alertLevel) { this.alertLevel = alertLevel; }
        public Integer getStatus() { return status; }
        public void setStatus(Integer status) { this.status = status; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public java.util.Date getCreateTime() { return createTime; }
        public void setCreateTime(java.util.Date createTime) { this.createTime = createTime; }
        public java.util.Date getUpdateTime() { return updateTime; }
        public void setUpdateTime(java.util.Date updateTime) { this.updateTime = updateTime; }
    }
}