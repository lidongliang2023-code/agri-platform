package com.agri.trade.service.impl;

import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.service.IDashboardService;
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
public class DashboardServiceImpl implements IDashboardService {

    private final TradeOrderMapper orderMapper;
    private final TradeProductMapper productMapper;
    private final Random random = new Random();

    @Override
    public IDashboardService.SellerDashboard getSellerDashboard(Long sellerId) {
        IDashboardService.SellerDashboard dashboard = new IDashboardService.SellerDashboard();
        dashboard.setSellerId(sellerId);
        dashboard.setSellerName("商家" + sellerId);

        LambdaQueryWrapper<TradeOrder> sellerOrderWrapper = new LambdaQueryWrapper<>();
        sellerOrderWrapper.eq(TradeOrder::getSellerId, sellerId);
        sellerOrderWrapper.eq(TradeOrder::getDelFlag, 0);
        
        List<TradeOrder> sellerOrders = orderMapper.selectList(sellerOrderWrapper);
        
        BigDecimal totalRevenue = sellerOrders.stream()
            .map(TradeOrder::getTotalAmount)
            .filter(a -> a != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        dashboard.setTotalRevenue(totalRevenue);

        LocalDate today = LocalDate.now();
        BigDecimal todayRevenue = sellerOrders.stream()
            .filter(o -> o.getCreateTime() != null && 
                LocalDate.from(o.getCreateTime().toInstant()).equals(today))
            .map(TradeOrder::getTotalAmount)
            .filter(a -> a != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        dashboard.setTodayRevenue(todayRevenue);

        dashboard.setTotalOrders(sellerOrders.size());
        dashboard.setTodayOrders((int) sellerOrders.stream()
            .filter(o -> o.getCreateTime() != null && 
                LocalDate.from(o.getCreateTime().toInstant()).equals(today))
            .count());

        dashboard.setPendingOrders((int) sellerOrders.stream()
            .filter(o -> "pending".equals(o.getOrderStatus()))
            .count());
        dashboard.setCompletedOrders((int) sellerOrders.stream()
            .filter(o -> "completed".equals(o.getOrderStatus()))
            .count());

        if (sellerOrders.size() > 0) {
            dashboard.setAvgOrderValue(totalRevenue.divide(
                BigDecimal.valueOf(sellerOrders.size()), 2, RoundingMode.HALF_UP));
        } else {
            dashboard.setAvgOrderValue(BigDecimal.ZERO);
        }

        dashboard.setAvgRating(BigDecimal.valueOf(4.5 + random.nextDouble() * 0.5).setScale(1, RoundingMode.HALF_UP));

        LambdaQueryWrapper<TradeProduct> productWrapper = new LambdaQueryWrapper<>();
        productWrapper.eq(TradeProduct::getSellerId, sellerId);
        productWrapper.eq(TradeProduct::getDelFlag, 0);
        List<TradeProduct> products = productMapper.selectList(productWrapper);
        dashboard.setProductCount(products.size());
        dashboard.setActiveProducts((int) products.stream()
            .filter(p -> "active".equals(p.getStatus()))
            .count());

        dashboard.setRevenueTrend(getTransactionTrend(sellerId, "seller", 7));
        dashboard.setTopProducts(getTopProducts(sellerId, 5));
        dashboard.setOrderStatusDistribution(getOrderStatusDistribution(sellerId, "seller"));

        return dashboard;
    }

    @Override
    public BuyerDashboard getBuyerDashboard(Long buyerId) {
        BuyerDashboard dashboard = new BuyerDashboard();
        dashboard.setBuyerId(buyerId);
        dashboard.setBuyerName("买家" + buyerId);

        LambdaQueryWrapper<TradeOrder> buyerOrderWrapper = new LambdaQueryWrapper<>();
        buyerOrderWrapper.eq(TradeOrder::getBuyerId, buyerId);
        buyerOrderWrapper.eq(TradeOrder::getDelFlag, 0);
        
        List<TradeOrder> buyerOrders = orderMapper.selectList(buyerOrderWrapper);
        
        BigDecimal totalSpent = buyerOrders.stream()
            .map(TradeOrder::getTotalAmount)
            .filter(a -> a != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        dashboard.setTotalSpent(totalSpent);

        LocalDate today = LocalDate.now();
        BigDecimal todaySpent = buyerOrders.stream()
            .filter(o -> o.getCreateTime() != null && 
                LocalDate.from(o.getCreateTime().toInstant()).equals(today))
            .map(TradeOrder::getTotalAmount)
            .filter(a -> a != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        dashboard.setTodaySpent(todaySpent);

        dashboard.setTotalOrders(buyerOrders.size());
        dashboard.setTodayOrders((int) buyerOrders.stream()
            .filter(o -> o.getCreateTime() != null && 
                LocalDate.from(o.getCreateTime().toInstant()).equals(today))
            .count());

        dashboard.setPendingOrders((int) buyerOrders.stream()
            .filter(o -> "pending".equals(o.getOrderStatus()))
            .count());
        dashboard.setCompletedOrders((int) buyerOrders.stream()
            .filter(o -> "completed".equals(o.getOrderStatus()))
            .count());

        if (buyerOrders.size() > 0) {
            dashboard.setAvgOrderValue(totalSpent.divide(
                BigDecimal.valueOf(buyerOrders.size()), 2, RoundingMode.HALF_UP));
        } else {
            dashboard.setAvgOrderValue(BigDecimal.ZERO);
        }

        dashboard.setFavoriteSellers(3 + random.nextInt(10));
        dashboard.setFollowedProducts(5 + random.nextInt(15));

        dashboard.setSpendingTrend(getTransactionTrend(buyerId, "buyer", 7));
        dashboard.setPurchaseCategories(getPurchaseCategories(buyerId));
        dashboard.setOrderStatusDistribution(getOrderStatusDistribution(buyerId, "buyer"));

        return dashboard;
    }

    @Override
    public Map<String, Object> getTransactionStats(Long userId, String userType) {
        Map<String, Object> stats = new HashMap<>();
        
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        if ("seller".equals(userType)) {
            wrapper.eq(TradeOrder::getSellerId, userId);
        } else {
            wrapper.eq(TradeOrder::getBuyerId, userId);
        }
        wrapper.eq(TradeOrder::getDelFlag, 0);
        
        List<TradeOrder> orders = orderMapper.selectList(wrapper);
        
        stats.put("totalOrders", orders.size());
        stats.put("totalAmount", orders.stream()
            .map(TradeOrder::getTotalAmount)
            .filter(a -> a != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add));
        stats.put("completedOrders", orders.stream()
            .filter(o -> "completed".equals(o.getOrderStatus()))
            .count());
        stats.put("pendingOrders", orders.stream()
            .filter(o -> "pending".equals(o.getOrderStatus()))
            .count());
        
        return stats;
    }

    @Override
    public List<IDashboardService.TransactionTrend> getTransactionTrend(Long userId, String userType, int days) {
        List<IDashboardService.TransactionTrend> trends = new ArrayList<>();
        LocalDate today = LocalDate.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        
        BigDecimal baseAmount = BigDecimal.valueOf(10000 + random.nextDouble() * 50000);
        
        for (int i = days - 1; i >= 0; i--) {
            String date = today.minusDays(i).format(formatter);
            BigDecimal amount = baseAmount.multiply(BigDecimal.valueOf(0.7 + random.nextDouble() * 0.6));
            int orderCount = 5 + random.nextInt(20);
            
            trends.add(new IDashboardService.TransactionTrend(date, amount.setScale(2, RoundingMode.HALF_UP), orderCount));
        }
        
        return trends;
    }

    @Override
    public List<IDashboardService.TopProduct> getTopProducts(Long sellerId, int limit) {
        List<IDashboardService.TopProduct> topProducts = new ArrayList<>();
        
        LambdaQueryWrapper<TradeProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProduct::getSellerId, sellerId);
        wrapper.eq(TradeProduct::getDelFlag, 0);
        wrapper.eq(TradeProduct::getStatus, "active");
        wrapper.orderByDesc(TradeProduct::getSalesVolume);
        wrapper.last("LIMIT " + limit);
        
        List<TradeProduct> products = productMapper.selectList(wrapper);
        
        for (TradeProduct product : products) {
            IDashboardService.TopProduct top = new IDashboardService.TopProduct();
            top.setProductId(product.getId());
            top.setProductName(product.getProductName());
            top.setTotalSales(BigDecimal.valueOf(random.nextDouble() * 100000).setScale(2, RoundingMode.HALF_UP));
            top.setSalesCount(random.nextInt(50) + 10);
            top.setAvgPrice(product.getUnitPrice() != null ? product.getUnitPrice() : BigDecimal.ZERO);
            topProducts.add(top);
        }
        
        return topProducts;
    }

    @Override
    public List<TopBuyer> getTopBuyers(Long sellerId, int limit) {
        List<TopBuyer> topBuyers = new ArrayList<>();
        
        for (int i = 0; i < Math.min(limit, 5); i++) {
            TopBuyer buyer = new TopBuyer();
            buyer.setBuyerId(Long.valueOf(1000 + i));
            buyer.setBuyerName("采购商" + (i + 1));
            buyer.setTotalPurchase(BigDecimal.valueOf(random.nextDouble() * 80000).setScale(2, RoundingMode.HALF_UP));
            buyer.setPurchaseCount(random.nextInt(15) + 5);
            topBuyers.add(buyer);
        }
        
        return topBuyers;
    }

    @Override
    public List<IDashboardService.OrderStatusStats> getOrderStatusDistribution(Long userId, String userType) {
        List<IDashboardService.OrderStatusStats> stats = new ArrayList<>();
        
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        if ("seller".equals(userType)) {
            wrapper.eq(TradeOrder::getSellerId, userId);
        } else {
            wrapper.eq(TradeOrder::getBuyerId, userId);
        }
        wrapper.eq(TradeOrder::getDelFlag, 0);
        
        List<TradeOrder> orders = orderMapper.selectList(wrapper);
        
        Map<String, IDashboardService.OrderStatusStats> statusMap = new HashMap<>();
        statusMap.put("pending", new IDashboardService.OrderStatusStats("pending", "待处理", 0, BigDecimal.ZERO));
        statusMap.put("confirmed", new IDashboardService.OrderStatusStats("confirmed", "已确认", 0, BigDecimal.ZERO));
        statusMap.put("shipped", new IDashboardService.OrderStatusStats("shipped", "已发货", 0, BigDecimal.ZERO));
        statusMap.put("completed", new IDashboardService.OrderStatusStats("completed", "已完成", 0, BigDecimal.ZERO));
        statusMap.put("cancelled", new IDashboardService.OrderStatusStats("cancelled", "已取消", 0, BigDecimal.ZERO));
        
        for (TradeOrder order : orders) {
            IDashboardService.OrderStatusStats stat = statusMap.get(order.getOrderStatus());
            if (stat != null) {
                stat.setCount(stat.getCount() + 1);
                if (order.getTotalAmount() != null) {
                    stat.setAmount(stat.getAmount().add(order.getTotalAmount()));
                }
            }
        }
        
        stats.addAll(statusMap.values());
        return stats;
    }

    private List<IDashboardService.TopBuyer.PurchaseCategory> getPurchaseCategories(Long buyerId) {
        List<IDashboardService.TopBuyer.PurchaseCategory> categories = new ArrayList<>();
        
        String[][] categoryData = {
            {"grain", "粮食", "50000"},
            {"vegetable", "蔬菜", "30000"},
            {"livestock", "畜牧", "20000"},
            {"agri_input", "农资", "15000"}
        };
        
        for (String[] data : categoryData) {
            IDashboardService.TopBuyer.PurchaseCategory cat = new IDashboardService.TopBuyer.PurchaseCategory();
            cat.setCategoryCode(data[0]);
            cat.setCategoryName(data[1]);
            cat.setTotalAmount(BigDecimal.valueOf(random.nextDouble() * Double.parseDouble(data[2])).setScale(2, RoundingMode.HALF_UP));
            cat.setOrderCount(random.nextInt(10) + 1);
            categories.add(cat);
        }
        
        return categories;
    }
}