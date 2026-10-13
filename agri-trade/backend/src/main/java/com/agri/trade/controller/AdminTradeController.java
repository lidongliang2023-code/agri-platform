package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.Dispute;
import com.agri.trade.entity.OrderItem;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.DisputeMapper;
import com.agri.trade.mapper.OrderItemMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 交易撮合 · 运营端接口（PRD V6.0 第 10.2 节）。
 *
 * <p>运营端此前**一个接口都没有**（从未注册），所以那 42 个页面无从谈起。
 * 本次先把三组最核心的立起来：交易大盘、货源审核、订单监管。</p>
 *
 * <p><b>路径为什么是 /api/trade/admin 而不是 /admin/trade</b>：
 * 前端运营端的**页面路由**就挂在 /admin/trade/** 下（/admin/trade/order 是页面，
 * /admin/trade/order/page 曾经是接口）。两者共用一个前缀时，网关无法区分
 * "浏览器要一张页面"和"前端要一份数据"：给接口放行就会把页面请求也送去后端，
 * 直接刷新页面就变成一个 404 白页。所以这里统一到本模块的接口族 /api/trade/** 下 ——
 * 规则简单到不会记错：**页面归 /admin/**，接口一律归 /api/**。
 * 平台级接口则走 /api/v1/**。**</p>
 *
 * <p>数据口径全部取自真实表，**不做任何写死的统计**。</p>
 *
 * <p>曾经存在的 /api/trade/operation/* 正是反面教材：大盘里的"品类分布/区域分布/7 天趋势"
 * 是代码里的字符串数组与随机数（风险预警还引用着 1001、2024001 这种库里根本不存在的 id），
 * 且没有任何前端在调。已整组删除 —— 保留一个"看起来有数据"的假接口，
 * 比没有这个接口更危险。将来做风控/报表时按真实表重建。</p>
 */
@Tag(name = "运营端 - 交易监管")
@RestController
@RequestMapping("/api/trade/admin")
@RequiredArgsConstructor
public class AdminTradeController {

    private final TradeOrderMapper orderMapper;
    private final TradeProductMapper productMapper;
    private final OrderItemMapper orderItemMapper;
    private final DisputeMapper disputeMapper;
    private final com.agri.trade.mapper.RefundRecordMapper refundMapper;
    private final com.agri.trade.mapper.CompensationRecordMapper compensationMapper;

    /** 交易大盘总览：订单与金额、待办件数、近 7 日趋势、品类与区域分布。 */
    @Operation(summary = "交易大盘总览")
    @GetMapping("/dashboard/overview")
    public ApiResponse<Map<String, Object>> dashboardOverview() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", buildSummary());
        result.put("todos", buildTodos());
        result.put("trend", last7Days());
        result.put("categoryStats", categoryStats());
        result.put("regionStats", regionStats());
        return ApiResponse.success(result);
    }

    private Map<String, Object> buildSummary() {
        List<TradeOrder> orders = orderMapper.selectList(new LambdaQueryWrapper<TradeOrder>().eq(TradeOrder::getDelFlag, 0));
        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal paidAmount = BigDecimal.ZERO;
        long pendingPayment = 0;
        long completed = 0;
        long refunding = 0;
        for (TradeOrder order : orders) {
            totalAmount = totalAmount.add(nullSafe(order.getTotalAmount()));
            paidAmount = paidAmount.add(nullSafe(order.getPaidAmount()));
            String status = order.getOrderStatus();
            if ("pending_confirm".equals(status) || "pending".equals(status)) {
                pendingPayment++;
            } else if ("completed".equals(status)) {
                completed++;
            } else if ("refunding".equals(status)) {
                refunding++;
            }
        }
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("orderCount", orders.size());
        summary.put("totalAmount", totalAmount);
        summary.put("paidAmount", paidAmount);
        summary.put("pendingPaymentCount", pendingPayment);
        summary.put("completedCount", completed);
        summary.put("refundingCount", refunding);
        summary.put("avgOrderAmount", orders.isEmpty()
                ? BigDecimal.ZERO
                : totalAmount.divide(BigDecimal.valueOf(orders.size()), 2, java.math.RoundingMode.HALF_UP));
        return summary;
    }

    /** 运营待办：待审核货源、待处理纠纷、退款中订单 —— 都是"现在需要有人动手"的件数。 */
    private Map<String, Object> buildTodos() {
        Map<String, Object> todos = new LinkedHashMap<>();
        todos.put("pendingProductCount", productMapper.selectCount(
                new LambdaQueryWrapper<TradeProduct>()
                        .eq(TradeProduct::getDelFlag, 0)
                        .eq(TradeProduct::getPublishStatus, "pending")));
        // 纠纷表**有**逻辑删除标记（del_flag），别忘了带上 —— 否则会把软删的单据也算进待办
        todos.put("openDisputeCount", disputeMapper.selectCount(
                new LambdaQueryWrapper<Dispute>()
                        .eq(Dispute::getDelFlag, 0)
                        .in(Dispute::getDisputeStatus, List.of("pending", "processing"))));
        todos.put("refundingOrderCount", orderMapper.selectCount(
                new LambdaQueryWrapper<TradeOrder>()
                        .eq(TradeOrder::getDelFlag, 0)
                        .eq(TradeOrder::getOrderStatus, "refunding")));
        // 赔付：待审核 + 已核准待打款。后者是"钱已经批了但还没出去"，口径上更急。
        todos.put("pendingCompensationCount", compensationMapper.selectCount(
                new LambdaQueryWrapper<com.agri.trade.entity.CompensationRecord>()
                        .eq(com.agri.trade.entity.CompensationRecord::getDelFlag, 0)
                        .eq(com.agri.trade.entity.CompensationRecord::getCompensationStatus, "pending")));
        todos.put("approvedCompensationCount", compensationMapper.selectCount(
                new LambdaQueryWrapper<com.agri.trade.entity.CompensationRecord>()
                        .eq(com.agri.trade.entity.CompensationRecord::getDelFlag, 0)
                        .eq(com.agri.trade.entity.CompensationRecord::getCompensationStatus, "approved")));
        return todos;
    }

    /**
     * 近 7 日交易趋势（按下单日聚合）。
     *
     * <p>用 selectMaps 走 SQL 分组，而不是把订单全量捞回内存里算；日期桶在 Java 侧补齐，
     * 保证没有订单的那天也出现在折线里（否则图上会"少几天"，看着像数据丢了）。</p>
     */
    private List<Map<String, Object>> last7Days() {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(6);

        QueryWrapper<TradeOrder> wrapper = new QueryWrapper<>();
        wrapper.select("DATE(create_time) AS d", "COUNT(*) AS cnt", "IFNULL(SUM(total_amount),0) AS amt")
                .eq("del_flag", 0)
                .ge("create_time", from.atStartOfDay())
                .groupBy("DATE(create_time)");

        Map<String, Map<String, Object>> byDay = new LinkedHashMap<>();
        for (Map<String, Object> row : orderMapper.selectMaps(wrapper)) {
            Object day = row.get("d");
            if (day == null) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("count", Long.valueOf(String.valueOf(row.get("cnt"))));
            item.put("amount", new BigDecimal(String.valueOf(row.get("amt"))));
            byDay.put(String.valueOf(day).substring(0, 10), item);
        }

        List<Map<String, Object>> trend = new ArrayList<>();
        for (LocalDate cursor = from; !cursor.isAfter(today); cursor = cursor.plusDays(1)) {
            String key = cursor.toString();
            Map<String, Object> item = byDay.get(key);
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", key);
            point.put("count", item == null ? 0L : item.get("count"));
            point.put("amount", item == null ? BigDecimal.ZERO : item.get("amount"));
            trend.add(point);
        }
        return trend;
    }

    /** 品类交易分布（按订单上的品类名聚合）。 */
    private List<Map<String, Object>> categoryStats() {
        QueryWrapper<TradeOrder> wrapper = new QueryWrapper<>();
        wrapper.select("IFNULL(category_name,'未分类') AS name", "COUNT(*) AS cnt", "IFNULL(SUM(total_amount),0) AS amt")
                .eq("del_flag", 0)
                .groupBy("IFNULL(category_name,'未分类')")
                .orderByDesc("amt");
        return mapGroups(orderMapper.selectMaps(wrapper));
    }

    /** 区域交易分布（按收货省份聚合）。 */
    private List<Map<String, Object>> regionStats() {
        QueryWrapper<TradeOrder> wrapper = new QueryWrapper<>();
        wrapper.select("IFNULL(delivery_province,'未填写') AS name", "COUNT(*) AS cnt", "IFNULL(SUM(total_amount),0) AS amt")
                .eq("del_flag", 0)
                .groupBy("IFNULL(delivery_province,'未填写')")
                .orderByDesc("amt");
        return mapGroups(orderMapper.selectMaps(wrapper));
    }

    private List<Map<String, Object>> mapGroups(List<Map<String, Object>> rows) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", row.get("name"));
            item.put("count", Long.valueOf(String.valueOf(row.get("cnt"))));
            item.put("amount", new BigDecimal(String.valueOf(row.get("amt"))));
            list.add(item);
        }
        return list;
    }

    /** 货源审核列表：按上架状态筛（默认看待审核）。 */
    @Operation(summary = "货源审核列表")
    @GetMapping("/product/page")
    public ApiResponse<IPage<TradeProduct>> productPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String publishStatus,
            @RequestParam(required = false) String keyword) {
        Page<TradeProduct> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<TradeProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProduct::getDelFlag, 0);
        wrapper.eq(TradeProduct::getPublishStatus,
                publishStatus == null || publishStatus.isEmpty() ? "pending" : publishStatus);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(TradeProduct::getProductName, keyword)
                    .or().like(TradeProduct::getProductCode, keyword)
                    .or().like(TradeProduct::getSellerName, keyword));
        }
        wrapper.orderByDesc(TradeProduct::getCreateTime);
        return ApiResponse.success(productMapper.selectPage(page, wrapper));
    }

    /**
     * 货源审核：通过 → published，驳回 → rejected。
     *
     * <p>审核痕迹（审核人/时间/意见）一并落库 —— 审核动作没有留痕，
     * 事后就无法回答"这条货源是谁放行的"。</p>
     */
    @Operation(summary = "货源审核")
    @PostMapping("/product/{id}/audit")
    public ApiResponse<Boolean> auditProduct(@PathVariable Long id, @RequestBody Map<String, Object> params) {
        TradeProduct product = productMapper.selectById(id);
        if (product == null) {
            return ApiResponse.error("货源不存在");
        }
        String pass = String.valueOf(params.getOrDefault("approved", "false"));
        boolean approved = "true".equalsIgnoreCase(pass) || "1".equals(pass);
        product.setPublishStatus(approved ? "published" : "rejected");
        product.setAuditor(SecurityUtils.getUsername());
        product.setAuditTime(new Date());
        product.setAuditRemark(params.get("auditRemark") == null ? null : params.get("auditRemark").toString());
        product.setUpdateTime(new Date());
        return productMapper.updateById(product) > 0
                ? ApiResponse.success(true)
                : ApiResponse.error("审核失败");
    }

    /** 订单监管列表：全平台订单，可按状态/支付状态/关键词查。 */
    @Operation(summary = "订单监管列表")
    @GetMapping("/order/page")
    public ApiResponse<IPage<TradeOrder>> orderPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String orderStatus,
            @RequestParam(required = false) String paymentStatus,
            @RequestParam(required = false) String keyword) {
        Page<TradeOrder> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getDelFlag, 0);
        if (orderStatus != null && !orderStatus.isEmpty()) {
            wrapper.eq(TradeOrder::getOrderStatus, orderStatus);
        }
        if (paymentStatus != null && !paymentStatus.isEmpty()) {
            wrapper.eq(TradeOrder::getPaymentStatus, paymentStatus);
        }
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(TradeOrder::getOrderNo, keyword)
                    .or().like(TradeOrder::getBuyerName, keyword)
                    .or().like(TradeOrder::getSellerName, keyword));
        }
        wrapper.orderByDesc(TradeOrder::getCreateTime);
        return ApiResponse.success(orderMapper.selectPage(page, wrapper));
    }

    /** 订单监管详情：订单 + 明细，供运营核对全链路。 */
    @Operation(summary = "订单监管详情")
    @GetMapping("/order/{id}")
    public ApiResponse<Map<String, Object>> orderDetail(@PathVariable Long id) {
        TradeOrder order = orderMapper.selectById(id);
        if (order == null) {
            return ApiResponse.error("订单不存在");
        }
        List<OrderItem> items = orderItemMapper.selectList(
                new LambdaQueryWrapper<OrderItem>().eq(OrderItem::getOrderId, id));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("order", order);
        result.put("items", items);
        return ApiResponse.success(result);
    }

    private static BigDecimal nullSafe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    /**
     * 纠纷仲裁列表（运营端）。
     *
     * <p>两套接口的分工：用户端 /api/trade/dispute/page 已按当前用户绑定的经营主体过滤
     * （范围由服务端从令牌推导，见 PlatformIdentityService）；运营端这里要的是全平台视野，
     * 所以显式走 /admin/ 前缀，不走用户端那套口径。</p>
     */
    @Operation(summary = "纠纷仲裁列表")
    @GetMapping("/dispute/page")
    public ApiResponse<IPage<Dispute>> disputePage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String disputeStatus,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String keyword) {
        Page<Dispute> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Dispute> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Dispute::getDelFlag, 0);
        // disputeStatus=open 表示"未结案件"，与运营大盘上"待处理纠纷"的口径一致
        // （大盘统计的是 pending + processing）。此前运营点开大盘的待办数字跳到这里，
        // 默认只看 processing，条数对不上。
        if ("open".equals(disputeStatus)) {
            wrapper.in(Dispute::getDisputeStatus, java.util.List.of("pending", "processing"));
        } else if (disputeStatus != null && !disputeStatus.isEmpty()) {
            wrapper.eq(Dispute::getDisputeStatus, disputeStatus);
        }
        if (stage != null && !stage.isEmpty()) {
            wrapper.eq(Dispute::getProcessStage, stage);
        }
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(Dispute::getDisputeNo, keyword)
                    .or().like(Dispute::getComplainantName, keyword)
                    .or().like(Dispute::getRespondentName, keyword));
        }
        wrapper.orderByDesc(Dispute::getCreateTime);
        return ApiResponse.success(disputeMapper.selectPage(page, wrapper));
    }

    /**
     * 退款审核列表（运营端）。
     *
     * <p>退款记录此前只有"申请"和"审核"两个写接口，没有任何列表入口 ——
     * 运营端根本看不到有哪些退款等着审。</p>
     */
    @Operation(summary = "退款审核列表")
    @GetMapping("/refund/page")
    public ApiResponse<IPage<com.agri.trade.entity.RefundRecord>> refundPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String refundStatus,
            @RequestParam(required = false) String keyword) {
        Page<com.agri.trade.entity.RefundRecord> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<com.agri.trade.entity.RefundRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(com.agri.trade.entity.RefundRecord::getDelFlag, 0);
        if (refundStatus != null && !refundStatus.isEmpty()) {
            wrapper.eq(com.agri.trade.entity.RefundRecord::getRefundStatus, refundStatus);
        }
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(com.agri.trade.entity.RefundRecord::getRefundNo, keyword)
                    .or().like(com.agri.trade.entity.RefundRecord::getOrderNo, keyword)
                    .or().like(com.agri.trade.entity.RefundRecord::getApplicantName, keyword));
        }
        wrapper.orderByDesc(com.agri.trade.entity.RefundRecord::getCreateTime);
        return ApiResponse.success(refundMapper.selectPage(page, wrapper));
    }

    /**
     * 赔付执行列表（运营端）。
     *
     * <p>与退款同一类问题：赔付只有"创建 / 审核 / 执行"三个写接口，**没有列表入口**，
     * 运营看不到有哪些赔付等着审、哪些已经核准等着打款。</p>
     */
    @Operation(summary = "赔付执行列表")
    @GetMapping("/compensation/page")
    public ApiResponse<IPage<com.agri.trade.entity.CompensationRecord>> compensationPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String compensationStatus,
            @RequestParam(required = false) String keyword) {
        Page<com.agri.trade.entity.CompensationRecord> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<com.agri.trade.entity.CompensationRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(com.agri.trade.entity.CompensationRecord::getDelFlag, 0);
        if (compensationStatus != null && !compensationStatus.isEmpty()) {
            wrapper.eq(com.agri.trade.entity.CompensationRecord::getCompensationStatus, compensationStatus);
        }
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(com.agri.trade.entity.CompensationRecord::getCompensationNo, keyword)
                    .or().like(com.agri.trade.entity.CompensationRecord::getOrderNo, keyword)
                    .or().like(com.agri.trade.entity.CompensationRecord::getRecipientName, keyword));
        }
        wrapper.orderByDesc(com.agri.trade.entity.CompensationRecord::getCreateTime);
        return ApiResponse.success(compensationMapper.selectPage(page, wrapper));
    }
}
