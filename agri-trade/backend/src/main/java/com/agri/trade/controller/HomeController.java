package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.OrderItem;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.OrderItemMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 用户端首页看板。
 *
 * <p><b>这个接口存在的原因是：首页此前根本没有请求后端。</b>
 * 前端 `api/home.ts` 直接返回写死的 mock（"累计交易额 128.5 亿"、"注册用户数 56.8 万人"，
 * 以及"山东寿光番茄 / 北京XX商贸"这类编出来的成交记录），页面照着一渲染，
 * 看起来一切正常、实际全是假的。</p>
 *
 * <p>现在每一项都有可核对的真实定义（下面每个字段的注释就是口径），
 * 且**只返回平台级聚合**：首页是公开门面，不按人过滤也不泄露具体买卖方名称。</p>
 */
@Tag(name = "用户端 - 首页看板")
@RestController
@RequestMapping("/api/trade/home")
@RequiredArgsConstructor
public class HomeController {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("MM-dd HH:mm");

    private final TradeOrderMapper orderMapper;
    private final TradeProductMapper productMapper;
    private final OrderItemMapper orderItemMapper;

    @Operation(summary = "首页看板汇总")
    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stat", buildStat());
        result.put("categoryQuotes", categoryQuotes());
        result.put("recentDeals", recentDeals());
        return ApiResponse.success(result);
    }

    /** 四个卡片：口径写在字段名里，前端标签要与之一致，不许再把"元"当"亿"显示。 */
    private Map<String, Object> buildStat() {
        List<TradeOrder> orders = orderMapper.selectList(new LambdaQueryWrapper<TradeOrder>()
                .eq(TradeOrder::getDelFlag, 0)
                // 已取消的订单不计入交易额与成交笔数
                .ne(TradeOrder::getOrderStatus, "cancelled"));

        BigDecimal amount = BigDecimal.ZERO;
        Set<Long> participants = new HashSet<>();
        for (TradeOrder order : orders) {
            amount = amount.add(order.getTotalAmount() == null ? BigDecimal.ZERO : order.getTotalAmount());
            if (order.getBuyerId() != null) {
                participants.add(order.getBuyerId());
            }
            if (order.getSellerId() != null) {
                participants.add(order.getSellerId());
            }
        }

        Map<String, Object> stat = new LinkedHashMap<>();
        stat.put("tradeAmount", amount);                       // 累计交易额（元）
        stat.put("dealCount", orders.size());                  // 累计成交笔数（笔）
        stat.put("participantCount", participants.size());      // 参与交易的买卖方数（家/人）
        stat.put("publishedProductCount", productMapper.selectCount(
                new LambdaQueryWrapper<TradeProduct>()
                        .eq(TradeProduct::getDelFlag, 0)
                        .eq(TradeProduct::getPublishStatus, "published"))); // 在架货源数（个）
        return stat;
    }

    /**
     * 品类行情：按品类汇总在架货源数与价格区间。
     *
     * <p>刻意不编"涨跌幅"与"成交量"—— 那需要历史价格与实际成交量两张数据，
     * 现在都没有；用写死的 +8.2% 装点门面正是这个页面原来的毛病。</p>
     */
    private List<Map<String, Object>> categoryQuotes() {
        QueryWrapper<TradeProduct> wrapper = new QueryWrapper<>();
        wrapper.select("IFNULL(category_name,'未分类') AS name",
                        "COUNT(*) AS cnt",
                        "MIN(price) AS min_price",
                        "MAX(price) AS max_price")
                .eq("del_flag", 0)
                .eq("publish_status", "published")
                .groupBy("IFNULL(category_name,'未分类')")
                .orderByDesc("cnt");
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> row : productMapper.selectMaps(wrapper)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("categoryName", row.get("name"));
            item.put("productCount", Long.valueOf(String.valueOf(row.get("cnt"))));
            item.put("minPrice", row.get("min_price"));
            item.put("maxPrice", row.get("max_price"));
            list.add(item);
        }
        return list;
    }

    /**
     * 最近成交：最新 5 笔订单的商品/数量/金额/时间。
     *
     * <p>**不返回买家名称**：首页是所有人都能看的页面，把别家买家的名字挂上去
     * 与前面刚修掉的越权面是同一类问题（原来那份 mock 里"北京XX商贸"虽然是编的，
     * 但形状就是在展示买家身份）。</p>
     */
    private List<Map<String, Object>> recentDeals() {
        List<TradeOrder> orders = orderMapper.selectList(new LambdaQueryWrapper<TradeOrder>()
                .eq(TradeOrder::getDelFlag, 0)
                .ne(TradeOrder::getOrderStatus, "cancelled")
                .orderByDesc(TradeOrder::getCreateTime)
                .last("LIMIT 5"));
        List<Map<String, Object>> list = new ArrayList<>();
        for (TradeOrder order : orders) {
            List<OrderItem> items = orderItemMapper.selectList(
                    new LambdaQueryWrapper<OrderItem>().eq(OrderItem::getOrderId, order.getId()));
            OrderItem first = items.isEmpty() ? null : items.get(0);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("orderNo", order.getOrderNo());
            item.put("productName", first == null ? (order.getCategoryName() == null ? "—" : order.getCategoryName()) : first.getProductName());
            item.put("quantity", first == null ? null : first.getQuantity());
            item.put("unit", first == null ? null : first.getUnit());
            item.put("amount", order.getTotalAmount());
            // TradeOrder.createTime 是 java.util.Date（本模块新旧字段混用 Date 与 LocalDateTime），
            // 不能用 DateTimeFormatter；局部建一个 SimpleDateFormat 即可（不跨线程共享）。
            java.util.Date created = order.getCreateTime();
            item.put("time", created == null ? null : new java.text.SimpleDateFormat("MM-dd HH:mm").format(created));
            list.add(item);
        }
        return list;
    }
}
