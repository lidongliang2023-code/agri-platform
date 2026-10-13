package com.agri.trade.service;

import com.agri.trade.entity.Evaluation;
import com.agri.trade.entity.PaymentRecord;
import com.agri.trade.entity.RiskAlert;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.EvaluationMapper;
import com.agri.trade.mapper.PaymentRecordMapper;
import com.agri.trade.mapper.RiskAlertMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 风控扫描（运营端）。
 *
 * <p><b>口径（本轮定下的三条规则，全部可在配置里调）</b>：
 * <ol>
 *   <li><b>异常低价</b>：在架货源的单价低于「同品类其它在架货源均价 × risk.low-price-ratio」。
 *       同品类在架货源少于 2 个时不判定 —— 均价没有意义，硬判会全是误报。</li>
 *   <li><b>差评集中</b>：主体在最近 risk.rating-window-days 天内，
 *       已展示评价的平均星级低于 risk.low-rating-threshold，且条数达到 risk.low-rating-min-count。
 *       条数下限是关键：只有一条差评就预警，会把正常商家也打上风险。</li>
 *   <li><b>发货超时</b>：订单已付款、状态仍是「已付款」（即一直没发货），
 *       且距付款时间超过 risk.delivery-timeout-hours 小时。</li>
 * </ol></p>
 *
 * <p><b>为什么是"扫描"而不是定时任务</b>：这三条规则都依赖运营自己定的阈值，
 * 自动跑会让人不知道告警是按哪套阈值出来的。现在由运营点一次"扫描"，
 * 每次扫描的结果都基于**当时生效的配置**，页面上的阈值也一并展示。</p>
 *
 * <p>刻意**不做**的：不做自动冻结/自动下架。风控只负责"发现问题并留痕"，
 * 处置动作走已有的违规下架/纠纷等入口，谁处置、处置了什么，各自留痕。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RiskService {

    private static final String RULE_LOW_PRICE = "low_price";
    private static final String RULE_LOW_RATING = "low_rating";
    private static final String RULE_DELIVERY_TIMEOUT = "delivery_timeout";

    private final RiskAlertMapper alertMapper;
    private final TradeProductMapper productMapper;
    private final EvaluationMapper evaluationMapper;
    private final TradeOrderMapper orderMapper;
    private final PaymentRecordMapper paymentMapper;
    private final TradeConfigService configService;

    /** 规则清单（页面展示"引擎在查什么、当期阈值是多少"）。 */
    public List<Map<String, Object>> rules() {
        List<Map<String, Object>> list = new ArrayList<>();
        list.add(rule(RULE_LOW_PRICE, "异常低价", "high", "risk.low-price-ratio",
                "在架货源单价低于同品类其它在架货源均价 × 该比例"));
        list.add(rule(RULE_LOW_RATING, "差评集中", "medium", "risk.low-rating-threshold",
                "主体在统计窗口内的平均星级低于该值、且评价条数达到下限"));
        list.add(rule(RULE_DELIVERY_TIMEOUT, "发货超时", "medium", "risk.delivery-timeout-hours",
                "订单已付款、状态仍是「已付款」且距付款时间超过该小时数"));
        return list;
    }

    private Map<String, Object> rule(String code, String name, String level, String thresholdKey, String description) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("ruleCode", code);
        map.put("ruleName", name);
        map.put("alertLevel", level);
        map.put("thresholdKey", thresholdKey);
        map.put("thresholdValue", configService.getString(thresholdKey, null));
        map.put("description", description);
        return map;
    }

    public IPage<RiskAlert> alertPage(int pageNum, int pageSize, String alertStatus, String ruleCode, String alertLevel) {
        LambdaQueryWrapper<RiskAlert> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RiskAlert::getDelFlag, 0);
        if (alertStatus != null && !alertStatus.isEmpty()) {
            wrapper.eq(RiskAlert::getAlertStatus, alertStatus);
        }
        if (ruleCode != null && !ruleCode.isEmpty()) {
            wrapper.eq(RiskAlert::getRuleCode, ruleCode);
        }
        if (alertLevel != null && !alertLevel.isEmpty()) {
            wrapper.eq(RiskAlert::getAlertLevel, alertLevel);
        }
        wrapper.orderByAsc(RiskAlert::getAlertStatus).orderByDesc(RiskAlert::getDetectedAt);
        return alertMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
    }

    /** 概览：各状态的告警数。 */
    public Map<String, Object> summary() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("newCount", countByStatus("new"));
        map.put("handledCount", countByStatus("handled"));
        map.put("ignoredCount", countByStatus("ignored"));
        return map;
    }

    private long countByStatus(String status) {
        Long count = alertMapper.selectCount(new LambdaQueryWrapper<RiskAlert>()
                .eq(RiskAlert::getDelFlag, 0)
                .eq(RiskAlert::getAlertStatus, status));
        return count == null ? 0 : count;
    }

    /**
     * 执行一次扫描。
     *
     * @return 各规则的检出/新增/跳过数量，便于运营判断"这次扫描有没有新东西"
     */
    @Transactional
    public Map<String, Object> scan(String operator) {
        List<RiskAlert> candidates = new ArrayList<>();
        Map<String, Object> result = new LinkedHashMap<>();

        List<RiskAlert> lowPrice = scanLowPrice();
        candidates.addAll(lowPrice);
        result.put(RULE_LOW_PRICE, saveCandidates(lowPrice));

        List<RiskAlert> lowRating = scanLowRating();
        candidates.addAll(lowRating);
        result.put(RULE_LOW_RATING, saveCandidates(lowRating));

        List<RiskAlert> deliveryTimeout = scanDeliveryTimeout();
        candidates.addAll(deliveryTimeout);
        result.put(RULE_DELIVERY_TIMEOUT, saveCandidates(deliveryTimeout));

        result.put("detectedTotal", candidates.size());
        log.info("风控扫描完成（{}）：{}", operator, result);
        return result;
    }

    /**
     * 落库：同一规则 + 同一对象若已有未处理的告警则跳过 ——
     * 否则每次扫描都会刷一批重复告警，真正该看的那条反而被淹掉。
     */
    private Map<String, Object> saveCandidates(List<RiskAlert> candidates) {
        int created = 0;
        int skipped = 0;
        for (RiskAlert candidate : candidates) {
            Long exists = alertMapper.selectCount(new LambdaQueryWrapper<RiskAlert>()
                    .eq(RiskAlert::getDelFlag, 0)
                    .eq(RiskAlert::getRuleCode, candidate.getRuleCode())
                    .eq(RiskAlert::getSubjectType, candidate.getSubjectType())
                    .eq(RiskAlert::getSubjectId, candidate.getSubjectId())
                    .eq(RiskAlert::getAlertStatus, "new"));
            if (exists != null && exists > 0) {
                skipped++;
                continue;
            }
            alertMapper.insert(candidate);
            created++;
        }
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("detected", candidates.size());
        map.put("created", created);
        map.put("skipped", skipped);
        return map;
    }

    // ------------------------------ 规则一：异常低价 ------------------------------

    private List<RiskAlert> scanLowPrice() {
        BigDecimal ratio = configService.getDecimal("risk.low-price-ratio", new BigDecimal("0.7"));
        List<TradeProduct> products = productMapper.selectList(new LambdaQueryWrapper<TradeProduct>()
                .eq(TradeProduct::getDelFlag, 0)
                .eq(TradeProduct::getPublishStatus, "published"));

        Map<Long, List<TradeProduct>> byCategory = products.stream()
                .filter(p -> effectivePrice(p) != null && p.getCategoryId() != null)
                .collect(Collectors.groupingBy(TradeProduct::getCategoryId));

        List<RiskAlert> alerts = new ArrayList<>();
        for (Map.Entry<Long, List<TradeProduct>> entry : byCategory.entrySet()) {
            List<TradeProduct> group = entry.getValue();
            // 同品类在架货源少于 3 个（自己 + 至少 2 个参照）时均价没有意义，不判定
            if (group.size() < 3) {
                continue;
            }
            for (TradeProduct product : group) {
                BigDecimal mine = effectivePrice(product);
                List<BigDecimal> others = group.stream()
                        .filter(p -> !p.getId().equals(product.getId()))
                        .map(this::effectivePrice)
                        .filter(java.util.Objects::nonNull)
                        .toList();
                if (others.isEmpty()) {
                    continue;
                }
                BigDecimal avg = others.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(others.size()), 2, RoundingMode.HALF_UP);
                BigDecimal threshold = avg.multiply(ratio).setScale(2, RoundingMode.HALF_UP);
                if (mine.compareTo(threshold) < 0) {
                    RiskAlert alert = base(RULE_LOW_PRICE, "异常低价", "high", "product",
                            product.getId(), product.getProductName());
                    alert.setTitle("货源定价明显低于同品类均价");
                    alert.setDetail(String.format("该货源 ¥%s/%s；同品类其它 %d 个在架货源均价 ¥%s，"
                                    + "低于均价的 %s（阈值线 ¥%s）。请核实是否标错单位或规格。",
                            mine.stripTrailingZeros().toPlainString(),
                            product.getUnit() == null ? "单位未填" : product.getUnit(),
                            others.size(), avg.toPlainString(),
                            ratio.multiply(BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString() + "%",
                            threshold.toPlainString()));
                    alerts.add(alert);
                }
            }
        }
        return alerts;
    }

    private BigDecimal effectivePrice(TradeProduct product) {
        if (product.getPrice() != null && product.getPrice().signum() > 0) {
            return product.getPrice();
        }
        if (product.getPriceMin() != null && product.getPriceMin().signum() > 0) {
            return product.getPriceMin();
        }
        return null;
    }

    // ------------------------------ 规则二：差评集中 ------------------------------

    private List<RiskAlert> scanLowRating() {
        BigDecimal threshold = configService.getDecimal("risk.low-rating-threshold", new BigDecimal("3.0"));
        int minCount = configService.getDecimal("risk.low-rating-min-count", new BigDecimal("2")).intValue();
        int windowDays = configService.getDecimal("risk.rating-window-days", new BigDecimal("30")).intValue();
        Date since = Date.from(LocalDateTime.now().minusDays(windowDays)
                .atZone(ZoneId.systemDefault()).toInstant());

        List<Evaluation> evaluations = evaluationMapper.selectList(new LambdaQueryWrapper<Evaluation>()
                .eq(Evaluation::getDelFlag, 0)
                .eq(Evaluation::getEvaluationStatus, "published")
                .ge(Evaluation::getCreateTime, since));

        Map<Long, List<Evaluation>> byEvaluatee = evaluations.stream()
                .filter(e -> e.getEvaluateeId() != null && e.getRatingOverall() != null)
                .collect(Collectors.groupingBy(Evaluation::getEvaluateeId));

        List<RiskAlert> alerts = new ArrayList<>();
        for (Map.Entry<Long, List<Evaluation>> entry : byEvaluatee.entrySet()) {
            List<Evaluation> list = entry.getValue();
            if (list.size() < minCount) {
                continue;
            }
            BigDecimal sum = list.stream().map(Evaluation::getRatingOverall)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal avg = sum.divide(BigDecimal.valueOf(list.size()), 2, RoundingMode.HALF_UP);
            if (avg.compareTo(threshold) >= 0) {
                continue;
            }
            String name = list.get(0).getEvaluateeName();
            RiskAlert alert = base(RULE_LOW_RATING, "差评集中", "medium", "merchant", entry.getKey(), name);
            alert.setTitle("主体近期平均评分偏低");
            alert.setDetail(String.format("近 %d 天内已展示评价 %d 条，平均 %s 分（阈值 %s 分，条数下限 %d）。",
                    windowDays, list.size(), avg.toPlainString(),
                    threshold.stripTrailingZeros().toPlainString(), minCount));
            alerts.add(alert);
        }
        return alerts;
    }

    // ------------------------------ 规则三：发货超时 ------------------------------

    private List<RiskAlert> scanDeliveryTimeout() {
        int timeoutHours = configService.getDecimal("risk.delivery-timeout-hours", new BigDecimal("48")).intValue();
        Date deadline = Date.from(LocalDateTime.now().minusHours(timeoutHours)
                .atZone(ZoneId.systemDefault()).toInstant());

        // 已付款但还停在「已付款」状态的订单 —— 说明钱到了、货一直没发
        List<TradeOrder> paidOrders = orderMapper.selectList(new LambdaQueryWrapper<TradeOrder>()
                .eq(TradeOrder::getDelFlag, 0)
                .eq(TradeOrder::getOrderStatus, "paid"));
        if (paidOrders.isEmpty()) {
            return List.of();
        }

        Map<Long, Date> paidAt = new HashMap<>();
        for (TradeOrder order : paidOrders) {
            // 支付流水表里"钱到了"的写法有两种：接口写入的是 success，
            // 演示/存量数据写的是 paid。只认 success 会让这条规则对存量订单**永远不触发**
            // （实测发现的：回拨 7601 的付款时间后仍不告警，因为它的流水状态是 paid）。
            List<PaymentRecord> payments = paymentMapper.selectList(new LambdaQueryWrapper<PaymentRecord>()
                    .eq(PaymentRecord::getOrderId, order.getId())
                    .in(PaymentRecord::getPaymentStatus, List.of("success", "paid"))
                    .orderByDesc(PaymentRecord::getPaymentTime));
            // 没有支付流水时退回订单创建时间：宁可早报，也不要因为缺流水而漏报
            Date anchor = payments.isEmpty() || payments.get(0).getPaymentTime() == null
                    ? order.getCreateTime() : payments.get(0).getPaymentTime();
            paidAt.put(order.getId(), anchor);
        }

        List<RiskAlert> alerts = new ArrayList<>();
        for (TradeOrder order : paidOrders) {
            Date anchor = paidAt.get(order.getId());
            if (anchor == null || !anchor.before(deadline)) {
                continue;
            }
            long hours = (System.currentTimeMillis() - anchor.getTime()) / 3600000L;
            RiskAlert alert = base(RULE_DELIVERY_TIMEOUT, "发货超时", "medium", "order",
                    order.getId(), order.getOrderNo());
            alert.setTitle("订单已付款但迟迟未发货");
            alert.setDetail(String.format("订单 %s 已付款 ¥%s（供应方：%s），付款至今已 %d 小时仍未发货"
                            + "（阈值 %d 小时），状态仍是「已付款」。",
                    order.getOrderNo(), order.getTotalAmount() == null ? "-" : order.getTotalAmount().toPlainString(),
                    order.getSellerName() == null ? "-" : order.getSellerName(), hours, timeoutHours));
            alerts.add(alert);
        }
        return alerts;
    }

    private RiskAlert base(String ruleCode, String ruleName, String level,
                           String subjectType, Long subjectId, String subjectName) {
        Date now = new Date();
        RiskAlert alert = new RiskAlert();
        alert.setAlertNo("RA" + System.currentTimeMillis() + "-" + subjectId);
        alert.setRuleCode(ruleCode);
        alert.setRuleName(ruleName);
        alert.setAlertLevel(level);
        alert.setSubjectType(subjectType);
        alert.setSubjectId(subjectId);
        alert.setSubjectName(subjectName);
        alert.setAlertStatus("new");
        alert.setDetectedAt(now);
        alert.setDelFlag(0);
        alert.setCreateTime(now);
        alert.setUpdateTime(now);
        return alert;
    }

    /**
     * 处理告警。
     *
     * @param status handled 已处理 / ignored 已忽略
     */
    @Transactional
    public String handle(Long id, String status, String remark, String operator) {
        RiskAlert alert = alertMapper.selectById(id);
        if (alert == null || (alert.getDelFlag() != null && alert.getDelFlag() == 1)) {
            return "告警不存在";
        }
        if (!"handled".equals(status) && !"ignored".equals(status)) {
            return "处理结果只支持 handled（已处理）或 ignored（已忽略）";
        }
        if (!"new".equals(alert.getAlertStatus())) {
            return "这条告警已经处理过了";
        }
        // 忽略必须写原因：忽略掉的风险，事后要能回答"当时为什么不看"
        if ("ignored".equals(status) && (remark == null || remark.trim().isEmpty())) {
            return "忽略告警必须填写原因";
        }
        alert.setAlertStatus(status);
        alert.setHandler(operator);
        alert.setHandleTime(new Date());
        alert.setHandleRemark(remark);
        alert.setUpdateTime(new Date());
        alertMapper.updateById(alert);
        log.info("风控告警处理：alertId={} status={} operator={}", id, status, operator);
        return null;
    }
}
