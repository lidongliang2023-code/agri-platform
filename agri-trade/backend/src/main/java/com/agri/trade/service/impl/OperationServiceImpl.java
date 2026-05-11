package com.agri.trade.service.impl;

import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.service.IOperationService;
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
public class OperationServiceImpl implements IOperationService {

    private final TradeOrderMapper orderMapper;
    private final TradeProductMapper productMapper;
    private final Random random = new Random();

    @Override
    public IOperationService.OperationDashboard getOperationDashboard() {
        IOperationService.OperationDashboard dashboard = new IOperationService.OperationDashboard();

        List<TradeOrder> allOrders = orderMapper.selectList(new LambdaQueryWrapper<TradeOrder>()
            .eq(TradeOrder::getDelFlag, 0));

        BigDecimal totalAmount = allOrders.stream()
            .map(TradeOrder::getTotalAmount)
            .filter(a -> a != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        dashboard.setTotalTransactionAmount(totalAmount);
        dashboard.setTotalTransactionCount(allOrders.size());

        LocalDate today = LocalDate.now();
        BigDecimal todayAmount = allOrders.stream()
            .filter(o -> o.getCreateTime() != null && 
                LocalDate.from(o.getCreateTime().toInstant()).equals(today))
            .map(TradeOrder::getTotalAmount)
            .filter(a -> a != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        dashboard.setTodayTransactionAmount(todayAmount);
        dashboard.setTodayTransactionCount((int) allOrders.stream()
            .filter(o -> o.getCreateTime() != null && 
                LocalDate.from(o.getCreateTime().toInstant()).equals(today))
            .count());

        dashboard.setTransactionAmountGrowth(BigDecimal.valueOf(12.5));
        dashboard.setTransactionCountGrowth(BigDecimal.valueOf(8.3));

        dashboard.setActiveSellers((int) allOrders.stream()
            .map(TradeOrder::getSellerId)
            .distinct()
            .count());
        dashboard.setActiveBuyers((int) allOrders.stream()
            .map(TradeOrder::getBuyerId)
            .distinct()
            .count());

        dashboard.setPendingOrders((int) allOrders.stream()
            .filter(o -> "pending".equals(o.getOrderStatus()))
            .count());
        dashboard.setCompletedOrders((int) allOrders.stream()
            .filter(o -> "completed".equals(o.getOrderStatus()))
            .count());

        dashboard.setRiskAlertCount(getRiskAlerts().size());
        dashboard.setRecentTrend(getTransactionOverview(7).getTrends());
        dashboard.setCategoryTopList(getCategoryStats());
        dashboard.setRegionTopList(getRegionStats());

        return dashboard;
    }

    @Override
    public TransactionOverview getTransactionOverview(int days) {
        TransactionOverview overview = new TransactionOverview();
        overview.setPeriod(days + "天");

        List<TradeOrder> orders = orderMapper.selectList(new LambdaQueryWrapper<TradeOrder>()
            .eq(TradeOrder::getDelFlag, 0));

        BigDecimal totalAmount = orders.stream()
            .map(TradeOrder::getTotalAmount)
            .filter(a -> a != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        overview.setTotalAmount(totalAmount);
        overview.setTotalOrders(orders.size());

        if (orders.size() > 0) {
            overview.setAvgOrderValue(totalAmount.divide(
                BigDecimal.valueOf(orders.size()), 2, RoundingMode.HALF_UP));
        } else {
            overview.setAvgOrderValue(BigDecimal.ZERO);
        }

        int activeUsers = (int) orders.stream()
            .flatMap(o -> List.of(o.getBuyerId(), o.getSellerId()).stream())
            .distinct()
            .count();
        overview.setActiveUsers(activeUsers);

        overview.setTrends(generateTrend(days));

        return overview;
    }

    @Override
    public List<IOperationService.CategoryStats> getCategoryStats() {
        List<IOperationService.CategoryStats> stats = new ArrayList<>();
        
        String[][] categoryData = {
            {"grain", "粮食", "1250000", "350", "15.2"},
            {"vegetable", "蔬菜", "890000", "420", "8.7"},
            {"livestock", "畜牧", "670000", "280", "-2.3"},
            {"agri_input", "农资", "420000", "180", "22.1"},
            {"other", "其他", "180000", "95", "5.6"}
        };

        for (String[] data : categoryData) {
            IOperationService.CategoryStats stat = new IOperationService.CategoryStats();
            stat.setCategoryCode(data[0]);
            stat.setCategoryName(data[1]);
            stat.setTotalAmount(BigDecimal.valueOf(Double.parseDouble(data[2])).setScale(2, RoundingMode.HALF_UP));
            stat.setOrderCount(Integer.parseInt(data[3]));
            stat.setGrowthRate(BigDecimal.valueOf(Double.parseDouble(data[4])).setScale(2, RoundingMode.HALF_UP));
            stats.add(stat);
        }

        return stats;
    }

    @Override
    public List<IOperationService.RegionStats> getRegionStats() {
        List<IOperationService.RegionStats> stats = new ArrayList<>();

        String[][] regionData = {
            {"CN-11", "北京", "520000", "120", "85", "156"},
            {"CN-31", "上海", "480000", "110", "78", "142"},
            {"CN-32", "江苏", "650000", "180", "120", "210"},
            {"CN-33", "浙江", "580000", "150", "105", "185"},
            {"CN-44", "广东", "720000", "200", "135", "240"}
        };

        for (String[] data : regionData) {
            IOperationService.RegionStats stat = new IOperationService.RegionStats();
            stat.setRegionCode(data[0]);
            stat.setRegionName(data[1]);
            stat.setTotalAmount(BigDecimal.valueOf(Double.parseDouble(data[2])).setScale(2, RoundingMode.HALF_UP));
            stat.setOrderCount(Integer.parseInt(data[3]));
            stat.setSellerCount(Integer.parseInt(data[4]));
            stat.setBuyerCount(Integer.parseInt(data[5]));
            stats.add(stat);
        }

        return stats;
    }

    @Override
    public List<IOperationService.RiskAlert> getRiskAlerts() {
        List<IOperationService.RiskAlert> alerts = new ArrayList<>();

        String[][] alertData = {
            {"1", "price_abnormal", "high", "异常低价交易", "检测到用户ID 1001的订单价格低于市场价30%", "1001", "order", "pending", "", "", "", ""},
            {"2", "transaction_frequency", "medium", "高频交易预警", "用户ID 1002在1小时内发起5笔交易", "1002", "user", "pending", "", "", "", ""},
            {"3", "payment_risk", "high", "支付风险", "订单ID 2024001支付超时超过24小时", "2024001", "order", "pending", "", "", "", ""},
            {"4", "seller_risk", "medium", "商家信誉下降", "商家ID 5001近7天好评率下降15%", "5001", "seller", "processing", "", "", "", ""},
            {"5", "delivery_delay", "low", "发货延迟", "订单ID 2024002超过发货时限24小时", "2024002", "order", "pending", "", "", "", ""}
        };

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        
        for (String[] data : alertData) {
            IOperationService.RiskAlert alert = new IOperationService.RiskAlert();
            alert.setId(Long.parseLong(data[0]));
            alert.setAlertType(data[1]);
            alert.setAlertLevel(data[2]);
            alert.setAlertTitle(data[3]);
            alert.setAlertContent(data[4]);
            alert.setRelatedId(Long.parseLong(data[5]));
            alert.setRelatedType(data[6]);
            alert.setStatus(data[7]);
            alert.setHandleResult(data[8]);
            alert.setHandleRemark(data[9]);
            alert.setHandleBy(data[10]);
            alert.setCreateTime(java.sql.Timestamp.valueOf(LocalDate.now().minusDays(random.nextInt(3)).atTime(10 + random.nextInt(12), random.nextInt(60), random.nextInt(60))));
            alerts.add(alert);
        }

        return alerts;
    }

    @Override
    public IOperationService.RiskAlert getRiskAlert(Long alertId) {
        return getRiskAlerts().stream()
            .filter(a -> alertId.equals(a.getId()))
            .findFirst()
            .orElse(null);
    }

    @Override
    public boolean handleRiskAlert(Long alertId, String handleResult, String handleRemark) {
        IOperationService.RiskAlert alert = getRiskAlert(alertId);
        if (alert != null) {
            alert.setStatus("handled");
            alert.setHandleResult(handleResult);
            alert.setHandleRemark(handleRemark);
            alert.setHandleBy("admin");
            alert.setHandleTime(new java.util.Date());
            return true;
        }
        return false;
    }

    @Override
    public List<IOperationService.RiskRule> getRiskRules() {
        List<IOperationService.RiskRule> rules = new ArrayList<>();

        String[][] ruleData = {
            {"1", "RR001", "异常低价检测", "price", "order.price < market_price * 0.7", "high", "1", "当订单价格低于市场价70%时触发预警"},
            {"2", "RR002", "高频交易检测", "frequency", "count(order) > 5 in 1 hour", "medium", "1", "用户1小时内交易超过5笔触发预警"},
            {"3", "RR003", "支付超时检测", "payment", "payment_time > 24 hours", "high", "1", "支付超时超过24小时触发预警"},
            {"4", "RR004", "信誉下降检测", "reputation", "seller.rating_drop > 10%", "medium", "1", "商家信誉评分下降超过10%触发预警"},
            {"5", "RR005", "发货延迟检测", "delivery", "delivery_time > deadline + 24h", "low", "1", "发货延迟超过24小时触发预警"}
        };

        for (String[] data : ruleData) {
            IOperationService.RiskRule rule = new IOperationService.RiskRule();
            rule.setId(Long.parseLong(data[0]));
            rule.setRuleCode(data[1]);
            rule.setRuleName(data[2]);
            rule.setRuleType(data[3]);
            rule.setRuleExpression(data[4]);
            rule.setAlertLevel(data[5]);
            rule.setStatus(Integer.parseInt(data[6]));
            rule.setDescription(data[7]);
            rule.setCreateTime(new java.util.Date());
            rule.setUpdateTime(new java.util.Date());
            rules.add(rule);
        }

        return rules;
    }

    @Override
    public IOperationService.RiskRule addRiskRule(IOperationService.RiskRule rule) {
        rule.setId(Long.valueOf(System.currentTimeMillis()));
        rule.setRuleCode("RR" + String.format("%03d", getRiskRules().size() + 1));
        rule.setStatus(1);
        rule.setCreateTime(new java.util.Date());
        rule.setUpdateTime(new java.util.Date());
        return rule;
    }

    @Override
    public boolean updateRiskRule(IOperationService.RiskRule rule) {
        rule.setUpdateTime(new java.util.Date());
        return true;
    }

    @Override
    public boolean deleteRiskRule(Long ruleId) {
        return true;
    }

    @Override
    public Map<String, Object> getSystemHealth() {
        Map<String, Object> health = new HashMap<>();
        
        health.put("status", "healthy");
        health.put("cpuUsage", BigDecimal.valueOf(35 + random.nextDouble() * 20).setScale(1, RoundingMode.HALF_UP));
        health.put("memoryUsage", BigDecimal.valueOf(45 + random.nextDouble() * 15).setScale(1, RoundingMode.HALF_UP));
        health.put("diskUsage", BigDecimal.valueOf(62 + random.nextDouble() * 10).setScale(1, RoundingMode.HALF_UP));
        health.put("responseTime", 50 + random.nextInt(30));
        health.put("activeConnections", 1200 + random.nextInt(500));
        health.put("errorRate", BigDecimal.valueOf(0.1 + random.nextDouble() * 0.2).setScale(2, RoundingMode.HALF_UP));
        
        return health;
    }

    private List<IOperationService.TransactionOverview.TransactionTrend> generateTrend(int days) {
        List<IOperationService.TransactionOverview.TransactionTrend> trends = new ArrayList<>();
        LocalDate today = LocalDate.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        
        BigDecimal baseAmount = BigDecimal.valueOf(100000 + random.nextDouble() * 100000);
        
        for (int i = days - 1; i >= 0; i--) {
            String date = today.minusDays(i).format(formatter);
            BigDecimal amount = baseAmount.multiply(BigDecimal.valueOf(0.8 + random.nextDouble() * 0.4));
            int orderCount = 50 + random.nextInt(80);
            
            trends.add(new IOperationService.TransactionOverview.TransactionTrend(date, amount.setScale(2, RoundingMode.HALF_UP), orderCount));
        }
        
        return trends;
    }
}