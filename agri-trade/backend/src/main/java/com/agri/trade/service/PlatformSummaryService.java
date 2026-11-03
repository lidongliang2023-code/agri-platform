package com.agri.trade.service;

import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 平台级交易大盘汇总：口径的唯一实现处。
 *
 * <p>登录用户端首页（{@code /api/trade/home/summary}）与官网门户（{@code /api/trade/public/summary}）
 * 都从这里取数。此前门户首页的「1268 亿成交 / 42 万笔 / 38 万用户」是前端写死的常量，
 * 与本模块真实统计无关，运营把商品下架、订单作废，首页数字也不会变。</p>
 *
 * <p><b>只返回平台级聚合</b>：这两个入口都不按人过滤，因此绝不返回具体买家/卖家名称、
 * 单号与逐笔金额——那是另一类越权面。</p>
 */
@Service
@RequiredArgsConstructor
public class PlatformSummaryService {

    private final TradeOrderMapper orderMapper;
    private final TradeProductMapper productMapper;

    /** 四个卡片：口径写在字段注释里，前端标签要与之一致，不许再把"元"当"亿"显示。 */
    public Map<String, Object> platformStat() {
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
}
