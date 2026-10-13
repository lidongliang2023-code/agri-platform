package com.agri.trade.service;

import com.agri.trade.entity.Settlement;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.SettlementMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

/**
 * 报表（运营端）。
 *
 * <p><b>口径</b>：全部来自真实表，且每个数字都能对得上 ——
 * 成交口径排除已取消订单（取消的不是成交），退款额取订单上的已退金额，
 * 结算额取结算表里已结算记录的总额。不设"环比/同比"这类需要历史基线才能算的指标，
 * 因为库里只有最近几天的数据，硬算出来的环比没有意义。</p>
 *
 * <p>粒度支持按日 / 按周（ISO 周，周一起） / 按月；时间段由运营指定。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final TradeOrderMapper orderMapper;
    private final SettlementMapper settlementMapper;

    /**
     * 交易报表：按粒度聚合。
     *
     * @param granularity day / week / month
     */
    public List<Map<String, Object>> tradeReport(LocalDate start, LocalDate end, String granularity) {
        List<TradeOrder> orders = ordersInRange(start, end);
        List<Settlement> settlements = settlementsInRange(start, end);

        // 用 TreeMap 保证时间段按时间顺序输出（空档期补 0，否则折线/表格会跳期）
        Map<String, Map<String, Object>> buckets = new TreeMap<>();
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            String key = bucketKey(day, granularity);
            buckets.computeIfAbsent(key, k -> emptyRow(k));
        }

        for (TradeOrder order : orders) {
            LocalDate day = toLocalDate(order.getCreateTime());
            if (day == null) continue;
            Map<String, Object> row = buckets.get(bucketKey(day, granularity));
            if (row == null) continue;
            add(row, "orderCount", 1);
            add(row, "orderAmount", nullToZero(order.getTotalAmount()));
            // 成交口径：取消掉的不是成交
            if (!"cancelled".equals(order.getOrderStatus())) {
                add(row, "dealCount", 1);
                add(row, "dealAmount", nullToZero(order.getTotalAmount()));
            }
            add(row, "refundAmount", nullToZero(order.getRefundAmount()));
        }
        for (Settlement settlement : settlements) {
            LocalDate day = toLocalDate(settlement.getSettleTime());
            if (day == null) continue;
            Map<String, Object> row = buckets.get(bucketKey(day, granularity));
            if (row == null) continue;
            add(row, "settleCount", 1);
            add(row, "settleAmount", nullToZero(settlement.getTotalAmount()));
            add(row, "platformFee", nullToZero(settlement.getPlatformFee()));
        }

        List<Map<String, Object>> rows = new ArrayList<>(buckets.values());
        for (Map<String, Object> row : rows) {
            BigDecimal dealAmount = (BigDecimal) row.get("dealAmount");
            int dealCount = (int) row.get("dealCount");
            row.put("avgOrderAmount", dealCount == 0 ? BigDecimal.ZERO
                    : dealAmount.divide(BigDecimal.valueOf(dealCount), 2, RoundingMode.HALF_UP));
        }
        return rows;
    }

    /** 品类报表：按品类聚合成交。 */
    public List<Map<String, Object>> categoryReport(LocalDate start, LocalDate end) {
        List<TradeOrder> orders = ordersInRange(start, end).stream()
                .filter(o -> !"cancelled".equals(o.getOrderStatus()))
                .toList();
        BigDecimal total = orders.stream().map(o -> nullToZero(o.getTotalAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Map<String, Object>> byCategory = new LinkedHashMap<>();
        for (TradeOrder order : orders) {
            String name = order.getCategoryName() == null || order.getCategoryName().isEmpty()
                    ? "未分类" : order.getCategoryName();
            Map<String, Object> row = byCategory.computeIfAbsent(name, k -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("categoryName", k);
                map.put("orderCount", 0);
                map.put("dealAmount", BigDecimal.ZERO);
                return map;
            });
            add(row, "orderCount", 1);
            add(row, "dealAmount", nullToZero(order.getTotalAmount()));
        }
        List<Map<String, Object>> rows = new ArrayList<>(byCategory.values());
        for (Map<String, Object> row : rows) {
            BigDecimal amount = (BigDecimal) row.get("dealAmount");
            row.put("share", total.signum() == 0 ? BigDecimal.ZERO
                    : amount.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP));
        }
        rows.sort(Comparator.comparing((Map<String, Object> r) -> (BigDecimal) r.get("dealAmount")).reversed());
        return rows;
    }

    /** 导出 CSV（带 BOM，Excel 直接打开不乱码）。 */
    public String exportCsv(LocalDate start, LocalDate end, String granularity, String type) {
        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF');
        if ("category".equals(type)) {
            sb.append("品类,成交笔数,成交额,占比(%)\n");
            for (Map<String, Object> row : categoryReport(start, end)) {
                sb.append(csv(row.get("categoryName"))).append(',')
                        .append(row.get("orderCount")).append(',')
                        .append(row.get("dealAmount")).append(',')
                        .append(row.get("share")).append('\n');
            }
        } else {
            sb.append("期间,订单笔数,订单金额,成交笔数,成交额,退款额,结算笔数,结算金额,平台服务费,客单价\n");
            for (Map<String, Object> row : tradeReport(start, end, granularity)) {
                sb.append(csv(row.get("period"))).append(',')
                        .append(row.get("orderCount")).append(',')
                        .append(row.get("orderAmount")).append(',')
                        .append(row.get("dealCount")).append(',')
                        .append(row.get("dealAmount")).append(',')
                        .append(row.get("refundAmount")).append(',')
                        .append(row.get("settleCount")).append(',')
                        .append(row.get("settleAmount")).append(',')
                        .append(row.get("platformFee")).append(',')
                        .append(row.get("avgOrderAmount")).append('\n');
            }
        }
        return sb.toString();
    }

    // ------------------------------ 内部 ------------------------------

    private List<TradeOrder> ordersInRange(LocalDate start, LocalDate end) {
        return orderMapper.selectList(new LambdaQueryWrapper<TradeOrder>()
                .eq(TradeOrder::getDelFlag, 0)
                .ge(TradeOrder::getCreateTime, toDate(start))
                .lt(TradeOrder::getCreateTime, toDate(end.plusDays(1))));
    }

    private List<Settlement> settlementsInRange(LocalDate start, LocalDate end) {
        return settlementMapper.selectList(new LambdaQueryWrapper<Settlement>()
                .eq(Settlement::getDelFlag, 0)
                .eq(Settlement::getSettleStatus, "settled")
                .ge(Settlement::getSettleTime, toDate(start))
                .lt(Settlement::getSettleTime, toDate(end.plusDays(1))));
    }

    private static Map<String, Object> emptyRow(String period) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("period", period);
        row.put("orderCount", 0);
        row.put("orderAmount", BigDecimal.ZERO);
        row.put("dealCount", 0);
        row.put("dealAmount", BigDecimal.ZERO);
        row.put("refundAmount", BigDecimal.ZERO);
        row.put("settleCount", 0);
        row.put("settleAmount", BigDecimal.ZERO);
        row.put("platformFee", BigDecimal.ZERO);
        return row;
    }

    private static String bucketKey(LocalDate day, String granularity) {
        if ("month".equalsIgnoreCase(granularity)) {
            return day.getYear() + "-" + String.format("%02d", day.getMonthValue()) + "（月）";
        }
        if ("week".equalsIgnoreCase(granularity)) {
            WeekFields wf = WeekFields.of(Locale.CHINA);
            return day.getYear() + "-W" + String.format("%02d", day.get(wf.weekOfWeekBasedYear()));
        }
        return day.format(DAY);
    }

    private static void add(Map<String, Object> row, String key, Object value) {
        if (value instanceof Integer count) {
            row.put(key, (int) row.get(key) + count);
        } else if (value instanceof BigDecimal amount) {
            row.put(key, ((BigDecimal) row.get(key)).add(amount));
        }
    }

    private static BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static LocalDate toLocalDate(Date date) {
        return date == null ? null : date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private static Date toDate(LocalDate date) {
        return Date.from(date.atStartOfDay(ZoneId.systemDefault()).toInstant());
    }

    private static String csv(Object value) {
        if (value == null) return "";
        String text = String.valueOf(value);
        return text.contains(",") || text.contains("\"")
                ? "\"" + text.replace("\"", "\"\"") + "\"" : text;
    }
}
