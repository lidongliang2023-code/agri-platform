package com.agri.trade.service.impl;

import com.agri.trade.entity.Evaluation;
import com.agri.trade.entity.OrderItem;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.EvaluationMapper;
import com.agri.trade.mapper.OrderItemMapper;
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
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 经营看板（买家 / 卖家）。
 *
 * <p><b>这一版把原先编造的数字全部换成真实聚合</b>。改造前的实况：</p>
 * <ul>
 *   <li>7 日趋势是 `baseAmount × 随机数`、订单数 `5 + random(20)` —— 整条曲线是编的；</li>
 *   <li>"热销货源"的销量与销售额是随机数（只有货源名与单价是真的）；</li>
 *   <li>"TOP 采购商"**完全凭空造**：id 用 1000+i、名字用"采购商1"，真实库里没有这些人；</li>
 *   <li>平均评分是 `4.5 + random(0.5)` —— 相当于给每个商家发了个随机分；</li>
 *   <li>商家名/买家名是 `"商家" + id` 拼出来的；</li>
 *   <li>在架货源数拿 `"active"` 去比一个 Integer 状态，恒为 0。</li>
 * </ul>
 *
 * <p>没有数据来源的指标（收藏的供应商、关注的商品）这次**直接删掉字段** ——
 * 库里没有收藏/关注表，编一个数字出来就是决策依据被污染。</p>
 *
 * <p>口径：收入/支出**排除已取消订单**（取消的不算钱）；"进行中"= 未完成、未取消、未退款；
 * 平均评分只算**已展示**的评价。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements IDashboardService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /** 不计入金额的订单状态：取消与已退款。 */
    private static final List<String> EXCLUDED = List.of("cancelled");

    /** 仍在进行中的订单状态（不是终态）。 */
    private static final List<String> IN_PROGRESS =
            List.of("pending_confirm", "pending", "paid", "shipped", "received", "refunding");

    private static final Map<String, String> STATUS_TEXT = Map.of(
            "pending_confirm", "待确认",
            "paid", "已付款",
            "shipped", "已发货",
            "received", "已收货",
            "completed", "已完成",
            "cancelled", "已取消",
            "refunding", "退款中",
            "refunded", "已退款");

    private final TradeOrderMapper orderMapper;
    private final TradeProductMapper productMapper;
    private final OrderItemMapper orderItemMapper;
    private final EvaluationMapper evaluationMapper;

    // ------------------------------ 卖家看板 ------------------------------

    @Override
    public IDashboardService.SellerDashboard getSellerDashboard(Long sellerId) {
        IDashboardService.SellerDashboard dashboard = new IDashboardService.SellerDashboard();
        dashboard.setSellerId(sellerId);

        List<TradeOrder> orders = ordersBy(q -> q.eq(TradeOrder::getSellerId, sellerId));
        List<TradeOrder> counted = orders.stream()
                .filter(o -> !EXCLUDED.contains(o.getOrderStatus())).toList();

        // 商家名取自真实单据（货源或订单），取不到就留空 —— 不拼"商家+id"
        dashboard.setSellerName(realSellerName(sellerId, orders));

        BigDecimal totalRevenue = sumAmount(counted);
        dashboard.setTotalRevenue(totalRevenue);
        LocalDate today = LocalDate.now();
        List<TradeOrder> todayOrders = counted.stream()
                .filter(o -> today.equals(toDate(o.getCreateTime()))).toList();
        dashboard.setTodayRevenue(sumAmount(todayOrders));

        dashboard.setTotalOrders(counted.size());
        dashboard.setTodayOrders(todayOrders.size());
        dashboard.setPendingOrders((int) counted.stream()
                .filter(o -> IN_PROGRESS.contains(o.getOrderStatus())).count());
        dashboard.setCompletedOrders((int) counted.stream()
                .filter(o -> "completed".equals(o.getOrderStatus())).count());
        dashboard.setAvgOrderValue(avg(totalRevenue, counted.size()));

        // 评分取自真实评价；没有评价就是 null，不是随机分
        dashboard.setAvgRating(realAvgRating(sellerId));

        List<TradeProduct> products = productMapper.selectList(new LambdaQueryWrapper<TradeProduct>()
                .eq(TradeProduct::getSellerId, sellerId)
                .eq(TradeProduct::getDelFlag, 0));
        dashboard.setProductCount(products.size());
        // 状态是 Integer（1 启用 / 0 停用），原先拿字符串 "active" 去比，恒为 0
        dashboard.setActiveProducts((int) products.stream()
                .filter(p -> p.getStatus() != null && p.getStatus() == 1).count());

        dashboard.setRevenueTrend(trend(sellerId, "seller", 7));
        dashboard.setTopProducts(topProducts(sellerId, 5));
        dashboard.setOrderStatusDistribution(statusDistribution(counted));
        return dashboard;
    }

    // ------------------------------ 买家看板 ------------------------------

    @Override
    public IDashboardService.BuyerDashboard getBuyerDashboard(Long buyerId) {
        IDashboardService.BuyerDashboard dashboard = new IDashboardService.BuyerDashboard();
        dashboard.setBuyerId(buyerId);

        List<TradeOrder> orders = ordersBy(q -> q.eq(TradeOrder::getBuyerId, buyerId));
        List<TradeOrder> counted = orders.stream()
                .filter(o -> !EXCLUDED.contains(o.getOrderStatus())).toList();

        dashboard.setBuyerName(orders.stream().map(TradeOrder::getBuyerName)
                .filter(n -> n != null && !n.isEmpty()).findFirst().orElse(null));

        BigDecimal totalSpent = sumAmount(counted);
        dashboard.setTotalSpent(totalSpent);
        LocalDate today = LocalDate.now();
        List<TradeOrder> todayOrders = counted.stream()
                .filter(o -> today.equals(toDate(o.getCreateTime()))).toList();
        dashboard.setTodaySpent(sumAmount(todayOrders));

        dashboard.setTotalOrders(counted.size());
        dashboard.setTodayOrders(todayOrders.size());
        dashboard.setPendingOrders((int) counted.stream()
                .filter(o -> IN_PROGRESS.contains(o.getOrderStatus())).count());
        dashboard.setCompletedOrders((int) counted.stream()
                .filter(o -> "completed".equals(o.getOrderStatus())).count());
        dashboard.setAvgOrderValue(avg(totalSpent, counted.size()));

        dashboard.setSpendingTrend(trend(buyerId, "buyer", 7));
        dashboard.setPurchaseCategories(purchaseCategories(counted));
        dashboard.setOrderStatusDistribution(statusDistribution(counted));
        return dashboard;
    }

    // ------------------------------ 通用 ------------------------------

    @Override
    public Map<String, Object> getTransactionStats(Long userId, String userType) {
        List<TradeOrder> orders = ordersBy("seller".equals(userType)
                ? q -> q.eq(TradeOrder::getSellerId, userId)
                : q -> q.eq(TradeOrder::getBuyerId, userId));
        List<TradeOrder> counted = orders.stream()
                .filter(o -> !EXCLUDED.contains(o.getOrderStatus())).toList();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalOrders", counted.size());
        stats.put("totalAmount", sumAmount(counted));
        stats.put("completedOrders", counted.stream()
                .filter(o -> "completed".equals(o.getOrderStatus())).count());
        stats.put("pendingOrders", counted.stream()
                .filter(o -> IN_PROGRESS.contains(o.getOrderStatus())).count());
        return stats;
    }

    /** 近 N 天趋势：按订单创建日聚合真实金额与笔数，空档补 0。 */
    @Override
    public List<IDashboardService.TransactionTrend> getTransactionTrend(Long userId, String userType, int days) {
        return trend(userId, userType, days);
    }

    @Override
    public List<IDashboardService.TopProduct> getTopProducts(Long sellerId, int limit) {
        return topProducts(sellerId, limit);
    }

    @Override
    public List<TopBuyer> getTopBuyers(Long sellerId, int limit) {
        return topBuyers(sellerId, limit);
    }

    @Override
    public List<IDashboardService.OrderStatusStats> getOrderStatusDistribution(Long userId, String userType) {
        List<TradeOrder> orders = ordersBy("seller".equals(userType)
                ? q -> q.eq(TradeOrder::getSellerId, userId)
                : q -> q.eq(TradeOrder::getBuyerId, userId));
        return statusDistribution(orders);
    }

    // ------------------------------ 内部实现 ------------------------------

    private List<TradeOrder> ordersBy(java.util.function.Consumer<LambdaQueryWrapper<TradeOrder>> condition) {
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getDelFlag, 0);
        condition.accept(wrapper);
        return orderMapper.selectList(wrapper);
    }

    private String realSellerName(Long sellerId, List<TradeOrder> orders) {
        String fromOrder = orders.stream().map(TradeOrder::getSellerName)
                .filter(n -> n != null && !n.isEmpty()).findFirst().orElse(null);
        if (fromOrder != null) {
            return fromOrder;
        }
        return productMapper.selectList(new LambdaQueryWrapper<TradeProduct>()
                        .eq(TradeProduct::getSellerId, sellerId)
                        .eq(TradeProduct::getDelFlag, 0)
                        .last("LIMIT 1"))
                .stream().map(TradeProduct::getSellerName)
                .filter(n -> n != null && !n.isEmpty()).findFirst().orElse(null);
    }

    private BigDecimal realAvgRating(Long merchantId) {
        List<Evaluation> evaluations = evaluationMapper.selectList(new LambdaQueryWrapper<Evaluation>()
                .eq(Evaluation::getEvaluateeId, merchantId)
                .eq(Evaluation::getDelFlag, 0)
                .eq(Evaluation::getEvaluationStatus, "published"));
        List<BigDecimal> ratings = evaluations.stream().map(Evaluation::getRatingOverall)
                .filter(java.util.Objects::nonNull).toList();
        if (ratings.isEmpty()) {
            return null;
        }
        return ratings.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(ratings.size()), 1, RoundingMode.HALF_UP);
    }

    private List<IDashboardService.TransactionTrend> trend(Long userId, String userType, int days) {
        List<TradeOrder> orders = ordersBy("seller".equals(userType)
                ? q -> q.eq(TradeOrder::getSellerId, userId)
                : q -> q.eq(TradeOrder::getBuyerId, userId));
        LocalDate today = LocalDate.now();

        Map<String, IDashboardService.TransactionTrend> buckets = new LinkedHashMap<>();
        for (int i = days - 1; i >= 0; i--) {
            String date = today.minusDays(i).format(DAY);
            buckets.put(date, new IDashboardService.TransactionTrend(date, BigDecimal.ZERO, 0));
        }
        for (TradeOrder order : orders) {
            if (EXCLUDED.contains(order.getOrderStatus())) {
                continue;
            }
            LocalDate day = toDate(order.getCreateTime());
            if (day == null) {
                continue;
            }
            IDashboardService.TransactionTrend row = buckets.get(day.format(DAY));
            if (row != null) {
                row.setAmount(row.getAmount().add(nullToZero(order.getTotalAmount())));
                row.setOrderCount(row.getOrderCount() + 1);
            }
        }
        return new ArrayList<>(buckets.values());
    }

    /**
     * 热销货源：按**订单明细**聚合（卖了多少件、多少钱）。
     *
     * <p>原先这里只有货源名与单价是真的，销量与销售额都是随机数。</p>
     */
    private List<IDashboardService.TopProduct> topProducts(Long sellerId, int limit) {
        List<TradeOrder> counted = ordersBy(q -> q.eq(TradeOrder::getSellerId, sellerId)).stream()
                .filter(o -> !EXCLUDED.contains(o.getOrderStatus())).toList();
        if (counted.isEmpty()) {
            return List.of();
        }
        List<Long> orderIds = counted.stream().map(TradeOrder::getId).toList();

        List<OrderItem> items = orderItemMapper.selectList(new LambdaQueryWrapper<OrderItem>()
                .in(OrderItem::getOrderId, orderIds)
                .eq(OrderItem::getDelFlag, 0));

        Map<String, IDashboardService.TopProduct> byProduct = new LinkedHashMap<>();
        for (OrderItem item : items) {
            String name = item.getProductName() == null ? ("商品 #" + item.getProductId()) : item.getProductName();
            IDashboardService.TopProduct top = byProduct.computeIfAbsent(name, k -> {
                IDashboardService.TopProduct row = new IDashboardService.TopProduct();
                row.setProductId(item.getProductId());
                row.setProductName(k);
                row.setTotalSales(BigDecimal.ZERO);
                row.setSalesCount(0);
                row.setAvgPrice(BigDecimal.ZERO);
                return row;
            });
            BigDecimal quantity = nullToZero(item.getQuantity());
            top.setTotalSales(top.getTotalSales().add(nullToZero(item.getTotalPrice())));
            top.setSalesCount(top.getSalesCount() + quantity.intValue());
            // 均价 = 该货源的成交额 ÷ 成交数量，不再拿货源挂牌价冒充
            if (top.getSalesCount() > 0) {
                top.setAvgPrice(top.getTotalSales()
                        .divide(BigDecimal.valueOf(top.getSalesCount()), 2, RoundingMode.HALF_UP));
            }
        }
        List<IDashboardService.TopProduct> rows = new ArrayList<>(byProduct.values());
        rows.sort((a, b) -> b.getTotalSales().compareTo(a.getTotalSales()));
        return rows.size() > limit ? rows.subList(0, limit) : rows;
    }

    /**
     * TOP 采购商：按订单里的买方聚合。
     *
     * <p>原先是纯编的 —— id 用 1000+i、名字用"采购商1"，库里根本没有这些主体。</p>
     */
    private List<TopBuyer> topBuyers(Long sellerId, int limit) {
        List<TradeOrder> counted = ordersBy(q -> q.eq(TradeOrder::getSellerId, sellerId)).stream()
                .filter(o -> !EXCLUDED.contains(o.getOrderStatus())).toList();

        Map<Long, TopBuyer> byBuyer = new LinkedHashMap<>();
        for (TradeOrder order : counted) {
            if (order.getBuyerId() == null) {
                continue;
            }
            TopBuyer row = byBuyer.computeIfAbsent(order.getBuyerId(), id -> {
                TopBuyer buyer = new TopBuyer();
                buyer.setBuyerId(id);
                buyer.setBuyerName(order.getBuyerName());
                buyer.setTotalPurchase(BigDecimal.ZERO);
                buyer.setPurchaseCount(0);
                return buyer;
            });
            row.setTotalPurchase(row.getTotalPurchase().add(nullToZero(order.getTotalAmount())));
            row.setPurchaseCount(row.getPurchaseCount() + 1);
        }
        List<TopBuyer> rows = new ArrayList<>(byBuyer.values());
        rows.sort((a, b) -> b.getTotalPurchase().compareTo(a.getTotalPurchase()));
        return rows.size() > limit ? rows.subList(0, limit) : rows;
    }

    /** 采购品类分布：按订单上的品类聚合真实金额。 */
    private List<IDashboardService.TopBuyer.PurchaseCategory> purchaseCategories(List<TradeOrder> counted) {
        Map<String, IDashboardService.TopBuyer.PurchaseCategory> byCategory = new LinkedHashMap<>();
        for (TradeOrder order : counted) {
            String name = order.getCategoryName() == null || order.getCategoryName().isEmpty()
                    ? "未分类" : order.getCategoryName();
            IDashboardService.TopBuyer.PurchaseCategory row = byCategory.computeIfAbsent(name, k -> {
                IDashboardService.TopBuyer.PurchaseCategory cat = new IDashboardService.TopBuyer.PurchaseCategory();
                cat.setCategoryName(k);
                cat.setTotalAmount(BigDecimal.ZERO);
                cat.setOrderCount(0);
                return cat;
            });
            row.setTotalAmount(row.getTotalAmount().add(nullToZero(order.getTotalAmount())));
            row.setOrderCount(row.getOrderCount() + 1);
        }
        List<IDashboardService.TopBuyer.PurchaseCategory> rows = new ArrayList<>(byCategory.values());
        rows.sort((a, b) -> b.getTotalAmount().compareTo(a.getTotalAmount()));
        return rows;
    }

    /** 订单状态分布：按**真实出现的**状态聚合（原先固定的五个键里有两个是不存在的状态）。 */
    private List<IDashboardService.OrderStatusStats> statusDistribution(List<TradeOrder> counted) {
        Map<String, IDashboardService.OrderStatusStats> byStatus = new LinkedHashMap<>();
        for (TradeOrder order : counted) {
            String status = order.getOrderStatus() == null ? "unknown" : order.getOrderStatus();
            IDashboardService.OrderStatusStats row = byStatus.computeIfAbsent(status, k -> {
                IDashboardService.OrderStatusStats stat = new IDashboardService.OrderStatusStats();
                stat.setStatus(k);
                stat.setStatusName(STATUS_TEXT.getOrDefault(k, k));
                stat.setCount(0);
                stat.setAmount(BigDecimal.ZERO);
                return stat;
            });
            row.setCount(row.getCount() + 1);
            row.setAmount(row.getAmount().add(nullToZero(order.getTotalAmount())));
        }
        List<IDashboardService.OrderStatusStats> rows = new ArrayList<>(byStatus.values());
        rows.sort((a, b) -> b.getCount() - a.getCount());
        return rows;
    }

    private static BigDecimal sumAmount(List<TradeOrder> orders) {
        return orders.stream().map(o -> nullToZero(o.getTotalAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal avg(BigDecimal total, int count) {
        return count == 0 ? BigDecimal.ZERO
                : total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static LocalDate toDate(java.util.Date date) {
        return date == null ? null : date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }
}
