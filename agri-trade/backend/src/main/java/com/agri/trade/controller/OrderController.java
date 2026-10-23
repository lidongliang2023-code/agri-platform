package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.OrderItem;
import com.agri.trade.entity.PaymentRecord;
import com.agri.trade.entity.RefundRecord;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.entity.Logistics;
import com.agri.trade.entity.LogisticsTrace;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.OrderItemMapper;
import com.agri.trade.mapper.PaymentRecordMapper;
import com.agri.trade.mapper.RefundRecordMapper;
import com.agri.trade.mapper.LogisticsMapper;
import com.agri.trade.mapper.LogisticsTraceMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/trade/order")
@RequiredArgsConstructor
public class OrderController {

    private final TradeOrderMapper orderMapper;
    private final OrderItemMapper itemMapper;
    private final PaymentRecordMapper paymentMapper;
    private final RefundRecordMapper refundMapper;
    private final LogisticsMapper logisticsMapper;
    private final LogisticsTraceMapper logisticsTraceMapper;
    private final TradeProductMapper productMapper;
    private final PlatformIdentityService identityService;

    /** 能发起退款的订单状态：钱已经在平台手里。待付款、已取消、已退款都没得退。 */
    private static final List<String> REFUNDABLE_ORDER_STATUS =
            List.of("paid", "shipped", "received", "completed");

    /**
     * 从货源直接下单（原型"订单管理 → 创建订单"）。
     *
     * <p>与报价转订单的区别：这条路径没有询价/报价环节，买家看中货源直接买。
     * 因此**价格必须服务端算**：单价取货源上的价格，货款 = 单价 × 数量，
     * 总额 = 货款 + 运费（运费可由请求带，优惠暂固定为 0）。
     * 直接采信请求里的总额等于把金额交给浏览器决定。</p>
     *
     * <p>买家取当前登录用户（平台令牌），卖家取货源上的供应商。</p>
     */
    @PostMapping("/from-product")
    public ApiResponse<TradeOrder> createOrderFromProduct(@RequestBody Map<String, Object> params) {
        Long productId = params.get("productId") == null ? null : Long.valueOf(params.get("productId").toString());
        BigDecimal quantity = params.get("quantity") == null ? null : new BigDecimal(params.get("quantity").toString());
        if (productId == null || quantity == null || quantity.signum() <= 0) {
            return ApiResponse.error("请选择货源并填写大于 0 的数量");
        }
        TradeProduct product = productMapper.selectById(productId);
        if (product == null) {
            return ApiResponse.error("货源不存在");
        }
        // 未上架的货源不能下单：草稿/待审核的货源只有卖家自己能看，不该能被买
        if (!"published".equals(product.getPublishStatus())) {
            return ApiResponse.error("该货源未上架，暂时不能下单");
        }
        if (product.getStockQuantity() != null && product.getStockQuantity().compareTo(quantity) < 0) {
            return ApiResponse.error("库存不足，当前可供数量：" + product.getStockQuantity() + " " + product.getUnit());
        }
        BigDecimal unitPrice = product.getPrice() != null ? product.getPrice() : product.getPriceMin();
        if (unitPrice == null || unitPrice.signum() <= 0) {
            return ApiResponse.error("该货源没有可用价格（缺价格与起报价），请先补充");
        }
        BigDecimal freight = params.get("freightAmount") == null
                ? BigDecimal.ZERO
                : new BigDecimal(params.get("freightAmount").toString());
        BigDecimal goods = unitPrice.multiply(quantity);

        // 买家 = 当前登录用户绑定的经营主体（不是平台用户 id —— 交易各表里的买方号是主体号，
        // 拿用户 id 塞进去就成了"下完单自己查不到"）。一人多主体时必须点名，不自动猜。
        PlatformIdentityService.MerchantSelection mine = identityService.selectMerchant(null);
        if (!mine.ok()) {
            return ApiResponse.error(mine.error());
        }

        Date now = new Date();
        TradeOrder order = new TradeOrder();
        order.setOrderNo("SO" + System.currentTimeMillis());
        order.setBuyerId(mine.merchantId());
        order.setBuyerName(mine.merchantName());
        order.setSellerId(product.getSellerId());
        order.setSellerName(product.getSellerName());
        order.setCategoryId(product.getCategoryId());
        order.setCategoryName(product.getCategoryName());
        order.setProductName(product.getProductName());
        order.setTotalQuantity(quantity);
        order.setGoodsAmount(goods);
        order.setFreightAmount(freight);
        order.setDiscountAmount(BigDecimal.ZERO);
        order.setTotalAmount(goods.add(freight));
        order.setPaidAmount(BigDecimal.ZERO);
        order.setCurrency("CNY");
        order.setPaymentStatus("unpaid");
        order.setOrderStatus("pending_confirm");
        order.setDeliveryProvince(str(params.get("deliveryProvince")));
        order.setDeliveryCity(str(params.get("deliveryCity")));
        order.setDeliveryAddress(str(params.get("deliveryAddress")));
        order.setDeliveryContact(str(params.get("deliveryContact")));
        order.setDeliveryPhone(str(params.get("deliveryPhone")));
        order.setSource("product");
        order.setDelFlag(0);
        order.setCreateTime(now);
        order.setUpdateTime(now);
        orderMapper.insert(order);

        OrderItem item = new OrderItem();
        item.setOrderId(order.getId());
        item.setProductId(product.getId());
        item.setProductName(product.getProductName());
        item.setCategoryId(product.getCategoryId());
        item.setCategoryName(product.getCategoryName());
        item.setVariety(product.getVariety());
        // OrderItem 实体只有 specLevel，没有 specSize（货源上有 specSize 但订单明细存不下它）
        item.setSpecLevel(product.getSpecLevel());
        item.setUnit(product.getUnit());
        item.setQuantity(quantity);
        item.setUnitPrice(unitPrice);
        // 实体映射的是 totalPrice（表里那个 amount 列实体不写）
        item.setTotalPrice(goods);
        item.setHarvestBatchNo(product.getHarvestBatchNo());
        item.setDelFlag(0);
        item.setCreateTime(now);
        itemMapper.insert(item);

        return ApiResponse.success(order);
    }

    private static String str(Object value) {
        return value == null ? null : value.toString();
    }

    @GetMapping("/page")
    public ApiResponse<IPage<TradeOrder>> getOrderPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String orderStatus,
            @RequestParam(required = false) String orderNo,
            @RequestParam(required = false) String paymentStatus,
            // 会员中心按端拆分：buyer 只看我作为买方的单，seller 只看我作为卖方的单。
            // 不传时保持原口径（我是买方或卖方都返回），范围仍由服务端从令牌推导。
            @RequestParam(required = false) String side) {
        // 参与方范围**由服务端从令牌推导**，前端不再传（第 2 步的收口）。
        // 之前是前端把登录用户 id 当 participantId 传上来：既查不到（两套号不是一个域），
        // 又能靠改这个参数看别人的单据 —— 范围是调用方自报的，等于没有范围。
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        Page<TradeOrder> page = new Page<>(pageNum, pageSize);
        if (!scope.hasBinding()) {
            // 已登录、但账号还没绑定经营主体：返回空页。这是**真的**没有"与我有关"的单据，
            // 与"不给范围就返回全平台订单"是两回事（后者是越权面）。
            // 前端会另行调 /api/trade/identity/my-merchants，把"尚未绑定主体"明确显示出来。
            return ApiResponse.success(page);
        }
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getDelFlag, 0);
        // 我名下的主体只要是买方或卖方就与我有关。全平台查询归运营端（/api/trade/admin/order/page）。
        List<Long> mine = scope.merchantIds();
        if ("buyer".equalsIgnoreCase(side)) {
            wrapper.in(TradeOrder::getBuyerId, mine);
        } else if ("seller".equalsIgnoreCase(side)) {
            wrapper.in(TradeOrder::getSellerId, mine);
        } else {
            wrapper.and(w -> w.in(TradeOrder::getBuyerId, mine).or().in(TradeOrder::getSellerId, mine));
        }
        if (orderStatus != null) wrapper.eq(TradeOrder::getOrderStatus, orderStatus);
        if (paymentStatus != null) wrapper.eq(TradeOrder::getPaymentStatus, paymentStatus);
        if (orderNo != null && !orderNo.isEmpty()) wrapper.like(TradeOrder::getOrderNo, orderNo);
        wrapper.orderByDesc(TradeOrder::getCreateTime);
        return ApiResponse.success(orderMapper.selectPage(page, wrapper));
    }

    @GetMapping("/{id}")
    public ApiResponse<TradeOrder> getOrderById(@PathVariable Long id) {
        TradeOrder order = orderMapper.selectById(id);
        if (order == null) return ApiResponse.error("订单不存在");
        String denied = denyIfNotParticipant(order);
        if (denied != null) return ApiResponse.error(denied);
        return ApiResponse.success(order);
    }

    @GetMapping("/{id}/items")
    public ApiResponse<List<OrderItem>> getOrderItems(@PathVariable Long id) {
        // 明细同样要判权：光锁住详情、留着明细等于没锁（订单 id 是连号的，猜一个就能看别人的货）。
        TradeOrder order = orderMapper.selectById(id);
        if (order == null) return ApiResponse.error("订单不存在");
        String denied = denyIfNotParticipant(order);
        if (denied != null) return ApiResponse.error(denied);
        LambdaQueryWrapper<OrderItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(OrderItem::getOrderId, id);
        wrapper.eq(OrderItem::getDelFlag, 0);
        return ApiResponse.success(itemMapper.selectList(wrapper));
    }

    /** 当前采购主体发起的退款/售后记录，供买家中心“收货与售后”统一展示。 */
    @GetMapping("/refund/mine")
    public ApiResponse<List<RefundRecord>> myRefunds() {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) return ApiResponse.error(scope.error());
        if (!scope.hasBinding()) return ApiResponse.success(List.of());
        List<Long> buyerOrderIds = orderMapper.selectList(new LambdaQueryWrapper<TradeOrder>()
                        .eq(TradeOrder::getDelFlag, 0)
                        .in(TradeOrder::getBuyerId, scope.merchantIds()))
                .stream().map(TradeOrder::getId).toList();
        LambdaQueryWrapper<RefundRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RefundRecord::getDelFlag, 0);
        // 买卖双方都可能发起退款：采购方既要看到自己申请的，也要看到供应商针对自己订单发起的。
        if (buyerOrderIds.isEmpty()) {
            wrapper.in(RefundRecord::getApplicantId, scope.merchantIds());
        } else {
            wrapper.and(w -> w.in(RefundRecord::getApplicantId, scope.merchantIds())
                    .or().in(RefundRecord::getOrderId, buyerOrderIds));
        }
        wrapper.orderByDesc(RefundRecord::getCreateTime);
        return ApiResponse.success(refundMapper.selectList(wrapper));
    }

    @PostMapping
    public ApiResponse<Boolean> createOrder(@RequestBody TradeOrder order) {
        // 买方身份不采信请求体：表单里带 buyerId 就能以别人名义建单。
        PlatformIdentityService.MerchantSelection mine = identityService.selectMerchant(order.getBuyerId());
        if (!mine.ok()) {
            return ApiResponse.error(mine.error());
        }
        order.setOrderNo("SO" + System.currentTimeMillis());
        order.setBuyerId(mine.merchantId());
        order.setBuyerName(mine.merchantName());
        order.setDelFlag(0);
        order.setOrderStatus("pending_confirm");
        order.setPaymentStatus("unpaid");
        order.setCreateTime(new Date());
        order.setUpdateTime(new Date());
        
        int result = orderMapper.insert(order);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> updateOrder(@PathVariable Long id, @RequestBody TradeOrder order) {
        TradeOrder existing = orderMapper.selectById(id);
        if (existing == null) return ApiResponse.error("订单不存在");
        String denied = denyIfNotParticipant(existing);
        if (denied != null) return ApiResponse.error(denied);
        // 页面只能补收货信息与备注，不能通过“编辑订单”改金额、参与方或状态。
        existing.setDeliveryProvince(order.getDeliveryProvince());
        existing.setDeliveryCity(order.getDeliveryCity());
        existing.setDeliveryDistrict(order.getDeliveryDistrict());
        existing.setDeliveryAddress(order.getDeliveryAddress());
        existing.setDeliveryContact(order.getDeliveryContact());
        existing.setDeliveryPhone(order.getDeliveryPhone());
        existing.setDeliveryDeadline(order.getDeliveryDeadline());
        existing.setBuyerRemark(order.getBuyerRemark());
        existing.setSellerRemark(order.getSellerRemark());
        existing.setUpdateTime(new Date());
        int result = orderMapper.updateById(existing);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("更新失败");
    }

    @PostMapping("/{id}/status")
    public ApiResponse<Boolean> updateOrderStatus(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        TradeOrder order = orderMapper.selectById(id);
        if (order == null) return ApiResponse.error("订单不存在");
        String denied = denyIfNotParticipant(order);
        if (denied != null) return ApiResponse.error(denied);
        
        String status = params.get("status");
        if (!"cancelled".equals(status)) {
            return ApiResponse.error("请使用支付、发货、确认收货等专用操作推进订单");
        }
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved() || !scope.merchantIds().contains(order.getBuyerId())) {
            return ApiResponse.error("只有采购方可以取消订单");
        }
        if (!List.of("pending_confirm", "pending").contains(order.getOrderStatus())
                || !"unpaid".equals(order.getPaymentStatus())) {
            return ApiResponse.error("已付款或已进入履约的订单不能直接取消");
        }
        order.setOrderStatus("cancelled");
        order.setUpdateTime(new Date());
        int result = orderMapper.updateById(order);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("取消失败");
    }

    @PostMapping("/{id}/pay")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Boolean> payOrder(@PathVariable Long id, @RequestBody java.util.Map<String, Object> params) {
        TradeOrder order = orderMapper.selectById(id);
        if (order == null) return ApiResponse.error("订单不存在");
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) return ApiResponse.error(scope.error());
        if (!scope.hasBinding() || !scope.merchantIds().contains(order.getBuyerId())) {
            return ApiResponse.error("只有采购方可以支付该订单");
        }
        if ("paid".equals(order.getPaymentStatus()) || "paid".equals(order.getOrderStatus())) {
            return ApiResponse.success(true);
        }
        if (!List.of("pending_confirm", "pending").contains(order.getOrderStatus())) {
            return ApiResponse.error("当前订单状态不能支付");
        }

        PaymentRecord payment = new PaymentRecord();
        payment.setPaymentNo("PY" + System.currentTimeMillis());
        payment.setOrderId(id);
        payment.setOrderNo(order.getOrderNo());
        payment.setPayerId(order.getBuyerId());
        payment.setPayerName(order.getBuyerName());
        payment.setPayeeId(order.getSellerId());
        payment.setPayeeName(order.getSellerName());
        payment.setAmount(order.getTotalAmount());
        payment.setActualAmount(order.getTotalAmount());
        Object rawMethod = params == null ? null : params.get("paymentMethod");
        String paymentMethod = rawMethod == null || String.valueOf(rawMethod).isBlank()
                ? "transfer" : String.valueOf(rawMethod);
        if (!List.of("transfer", "wechat", "alipay", "bank").contains(paymentMethod)) {
            return ApiResponse.error("不支持的支付方式");
        }
        payment.setPaymentMethod(paymentMethod);
        payment.setPaymentStatus("success");
        payment.setTransactionId("TX" + UUID.randomUUID().toString().substring(0, 20));
        payment.setIdempotentKey("ORDER-PAY-" + id);
        payment.setPaymentTime(new Date());
        payment.setDelFlag(0);
        payment.setCreateTime(new Date());

        int result = paymentMapper.insert(payment);
        if (result > 0) {
            order.setPaymentStatus("paid");
            order.setPaidAmount(order.getTotalAmount());
            order.setOrderStatus("paid");
            order.setPaymentMethod(paymentMethod);
            order.setUpdateTime(new Date());
            orderMapper.updateById(order);
            return ApiResponse.success(true);
        }
        return ApiResponse.error("支付失败");
    }

    /** 卖家发货：生成物流单、写入揽收轨迹并推进订单。 */
    @PostMapping("/{id}/ship")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Logistics> shipOrder(@PathVariable Long id,
                                            @RequestBody(required = false) Map<String, Object> params) {
        TradeOrder order = orderMapper.selectById(id);
        if (order == null) return ApiResponse.error("订单不存在");
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) return ApiResponse.error(scope.error());
        if (!scope.hasBinding() || !scope.merchantIds().contains(order.getSellerId())) {
            return ApiResponse.error("只有供货方可以发货");
        }
        if (!"paid".equals(order.getOrderStatus()) || !"paid".equals(order.getPaymentStatus())) {
            return ApiResponse.error("订单尚未支付或已经进入下一环节，不能重复发货");
        }

        Date now = new Date();
        Logistics logistics = logisticsMapper.selectOne(new LambdaQueryWrapper<Logistics>()
                .eq(Logistics::getOrderId, id)
                .eq(Logistics::getDelFlag, 0)
                .orderByDesc(Logistics::getId)
                .last("LIMIT 1"));
        boolean created = logistics == null;
        if (created) {
            logistics = new Logistics();
            logistics.setLogisticsNo("LG" + System.currentTimeMillis());
            logistics.setOrderId(id);
            logistics.setOrderNo(order.getOrderNo());
            logistics.setDelFlag(0);
            logistics.setCreateTime(now);
        }
        logistics.setCarrierName(strOr(params == null ? null : params.get("carrierName"), "平台物流"));
        logistics.setCarrierNo(strOr(params == null ? null : params.get("carrierNo"), null));
        logistics.setLogisticsType(strOr(params == null ? null : params.get("logisticsType"), "road"));
        logistics.setSenderProvince(order.getSellerProvince());
        logistics.setSenderCity(order.getSellerCity());
        logistics.setSenderAddress(order.getSellerAddress());
        logistics.setSenderContact(order.getSellerName());
        logistics.setSenderPhone(order.getSellerPhone());
        logistics.setReceiverProvince(order.getDeliveryProvince());
        logistics.setReceiverCity(order.getDeliveryCity());
        logistics.setReceiverDistrict(order.getDeliveryDistrict());
        logistics.setReceiverAddress(order.getDeliveryAddress());
        logistics.setReceiverContact(order.getDeliveryContact());
        logistics.setReceiverPhone(order.getDeliveryPhone());
        logistics.setGoodsName(order.getProductName() == null ? order.getCategoryName() : order.getProductName());
        logistics.setGoodsCount(1);
        logistics.setFreightAmount(order.getFreightAmount());
        logistics.setPayMethod(order.getPaymentMethod());
        logistics.setExpectDeliveryTime(order.getDeliveryDeadline());
        logistics.setPickupTime(now);
        logistics.setLogisticsStatus("picked");
        logistics.setCurrentLocation(strOr(params == null ? null : params.get("location"), "供应商仓库"));
        logistics.setUpdateTime(now);
        if (created) logisticsMapper.insert(logistics);
        else logisticsMapper.updateById(logistics);
        addLogisticsTrace(logistics, "picked", logistics.getCurrentLocation());

        order.setOrderStatus("shipped");
        order.setLogisticsId(logistics.getId());
        order.setLogisticsNo(logistics.getLogisticsNo());
        order.setLogisticsStatus("picked");
        order.setShipDeadline(now);
        order.setUpdateTime(now);
        orderMapper.updateById(order);
        return ApiResponse.success(logistics);
    }

    /** 买家确认收货：同步物流签收与订单收货状态。 */
    @PostMapping("/{id}/confirm-receipt")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Boolean> confirmReceipt(@PathVariable Long id,
                                               @RequestBody(required = false) Map<String, Object> params) {
        TradeOrder order = orderMapper.selectById(id);
        if (order == null) return ApiResponse.error("订单不存在");
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) return ApiResponse.error(scope.error());
        if (!scope.hasBinding() || !scope.merchantIds().contains(order.getBuyerId())) {
            return ApiResponse.error("只有采购方可以确认收货");
        }
        if (!"shipped".equals(order.getOrderStatus())) {
            return ApiResponse.error("当前订单不在待收货状态");
        }
        Date now = new Date();
        order.setOrderStatus("received");
        order.setBuyerConfirmed(1);
        order.setBuyerConfirmTime(now);
        order.setSignTime(now);
        order.setLogisticsStatus("delivered");
        order.setUpdateTime(now);
        orderMapper.updateById(order);

        Logistics logistics = order.getLogisticsId() == null ? null : logisticsMapper.selectById(order.getLogisticsId());
        if (logistics != null) {
            logistics.setLogisticsStatus("delivered");
            logistics.setDeliveryTime(now);
            logistics.setActualArrivalTime(now);
            logistics.setSignTime(now);
            logistics.setSignReceiver(strOr(params == null ? null : params.get("signReceiver"), order.getDeliveryContact()));
            logistics.setCurrentLocation(order.getDeliveryAddress());
            logistics.setUpdateTime(now);
            logisticsMapper.updateById(logistics);
            addLogisticsTrace(logistics, "delivered", order.getDeliveryAddress());
        }
        return ApiResponse.success(true);
    }

    @PostMapping("/{id}/refund")
    public ApiResponse<Boolean> applyRefund(@PathVariable Long id, @RequestBody java.util.Map<String, Object> params) {
        TradeOrder order = orderMapper.selectById(id);
        if (order == null) return ApiResponse.error("订单不存在");
        String denied = denyIfNotParticipant(order);
        if (denied != null) return ApiResponse.error(denied);

        // 一单一待审：同一订单已经挂着待审退款单时不允许再申请一条。
        // 原先没有任何拦截 —— 反复点"申请退款"能生成一堆待审单，运营端看到的是
        // 互相打架的几个金额，通过任意一条都可能把整单置为已退款。
        Long pending = refundMapper.selectCount(new LambdaQueryWrapper<RefundRecord>()
                .eq(RefundRecord::getOrderId, id)
                .eq(RefundRecord::getRefundStatus, "pending")
                .eq(RefundRecord::getDelFlag, 0));
        if (pending != null && pending > 0) {
            return ApiResponse.error("该订单已有一条待审核的退款申请，请等运营审核完成");
        }
        if (!REFUNDABLE_ORDER_STATUS.contains(order.getOrderStatus())) {
            return ApiResponse.error("当前订单状态（" + order.getOrderStatus() + "）不能发起退款");
        }

        // 金额必须服务端校验：原先直接 new BigDecimal(params.get(...)) —— 传个负数、
        // 传个比货款还大的数、或者干脆不传（NPE 后 500），都能走到插入。
        Object rawAmount = params.get("refundAmount");
        if (rawAmount == null || String.valueOf(rawAmount).trim().isEmpty()) {
            return ApiResponse.error("退款金额不能为空");
        }
        BigDecimal amount;
        try {
            amount = new BigDecimal(String.valueOf(rawAmount));
        } catch (NumberFormatException e) {
            return ApiResponse.error("退款金额格式不正确");
        }
        BigDecimal paid = order.getPaidAmount() == null ? BigDecimal.ZERO : order.getPaidAmount();
        BigDecimal alreadyRefunded = order.getRefundAmount() == null ? BigDecimal.ZERO : order.getRefundAmount();
        BigDecimal refundable = paid.subtract(alreadyRefunded);
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ApiResponse.error("退款金额必须大于 0");
        }
        if (amount.compareTo(refundable) > 0) {
            return ApiResponse.error("退款金额不能超过可退金额：" + refundable + " 元");
        }

        // 申请人取当前主体的那一侧，不采信请求体里的 applicantId/applicantType ——
        // 原先申请人一律写成买方，卖方发起时单据上会显示成买方申请的。
        Long applicantId = order.getBuyerId();
        String applicantName = order.getBuyerName();
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (scope.resolved() && !scope.merchantIds().contains(order.getBuyerId())) {
            applicantId = order.getSellerId();
            applicantName = order.getSellerName();
        }

        RefundRecord refund = new RefundRecord();
        refund.setRefundNo("RF" + System.currentTimeMillis());
        refund.setOrderId(id);
        refund.setOrderNo(order.getOrderNo());
        String refundType = strOr(params.get("refundType"), "refund_only");
        if (!List.of("full", "partial", "refund_only", "return_refund").contains(refundType)) {
            return ApiResponse.error("不支持的退款类型");
        }
        refund.setRefundType(refundType);
        refund.setRefundAmount(amount);
        refund.setRefundReason((String) params.get("refundReason"));
        refund.setApplicantType(applicantId.equals(order.getBuyerId()) ? "buyer" : "seller");
        refund.setApplicantId(applicantId);
        refund.setApplicantName(applicantName);
        refund.setRefundStatus("pending");
        refund.setDelFlag(0);
        refund.setCreateTime(new Date());
        PaymentRecord paidRecord = paymentMapper.selectOne(new LambdaQueryWrapper<PaymentRecord>()
                .eq(PaymentRecord::getOrderId, id)
                .eq(PaymentRecord::getPaymentStatus, "success")
                .eq(PaymentRecord::getDelFlag, 0)
                .orderByDesc(PaymentRecord::getId)
                .last("LIMIT 1"));
        refund.setPaymentId(paidRecord == null ? null : paidRecord.getId());

        int result = refundMapper.insert(refund);
        if (result > 0) {
            order.setOrderStatus("refunding");
            order.setUpdateTime(new Date());
            orderMapper.updateById(order);
            return ApiResponse.success(true);
        }
        return ApiResponse.error("申请失败");
    }

    @PostMapping("/refund/{id}/audit")
    @com.agri.common.rbac.OperatorOnly
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Boolean> auditRefund(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        RefundRecord refund = refundMapper.selectById(id);
        if (refund == null) return ApiResponse.error("退款记录不存在");

        String status = params.get("status");
        if (!"approved".equals(status) && !"rejected".equals(status)) {
            return ApiResponse.error("审核结果只能是 approved（通过）或 rejected（驳回）");
        }
        // 一张退款单只能审一次：原先已驳回/已通过的单还能再审 ——
        // 驳回后隔一会儿再点"通过"，钱照样退，驳回等于没发生。
        if (!"pending".equals(refund.getRefundStatus())) {
            return ApiResponse.error("这条退款申请已经处理过了（" + refund.getRefundStatus() + "），不能重复审核");
        }

        refund.setRefundStatus(status);
        refund.setReviewer(params.get("reviewer"));
        refund.setReviewTime(new Date());
        refund.setReviewRemark(params.get("remark"));
        refund.setUpdateTime(new Date());
        refund.setFinishTime(new Date());

        int result = refundMapper.updateById(refund);
        if (result <= 0) {
            return ApiResponse.error("审核失败");
        }
        if ("approved".equals(status)) {
            TradeOrder order = orderMapper.selectById(refund.getOrderId());
            if (order != null) {
                // 累加已退金额时必须容 null：经接口新建的订单没有写 refund_amount，
                // 直接 .add() 会 NPE，表现是"审核通过"这个动作 500。
                BigDecimal refunded = order.getRefundAmount() == null ? BigDecimal.ZERO : order.getRefundAmount();
                BigDecimal current = refund.getRefundAmount() == null ? BigDecimal.ZERO : refund.getRefundAmount();
                order.setRefundAmount(refunded.add(current));
                order.setPaymentStatus("refunded");
                order.setOrderStatus("refunded");
                order.setUpdateTime(new Date());
                orderMapper.updateById(order);
                PaymentRecord payment = refund.getPaymentId() == null
                        ? paymentMapper.selectOne(new LambdaQueryWrapper<PaymentRecord>()
                                .eq(PaymentRecord::getOrderId, order.getId())
                                .eq(PaymentRecord::getPaymentStatus, "success")
                                .eq(PaymentRecord::getDelFlag, 0)
                                .orderByDesc(PaymentRecord::getId)
                                .last("LIMIT 1"))
                        : paymentMapper.selectById(refund.getPaymentId());
                if (payment != null) {
                    payment.setPaymentStatus("refunded");
                    payment.setUpdateTime(new Date());
                    paymentMapper.updateById(payment);
                }
                refund.setRefundTime(new Date());
                refundMapper.updateById(refund);
            }
            return ApiResponse.success(true);
        }

        // 驳回：必须把订单从"售后中"放回去。
        // 原先驳回只改退款单、不动订单 —— 订单就永远停在 refunding（PRD 词表里的"5 售后中"）：
        // 发不了货、也收不了货，买卖双方都没有下一步可做，等于这张单被卡死。
        TradeOrder order = orderMapper.selectById(refund.getOrderId());
        if (order != null && "refunding".equals(order.getOrderStatus())) {
            Long stillPending = refundMapper.selectCount(new LambdaQueryWrapper<RefundRecord>()
                    .eq(RefundRecord::getOrderId, refund.getOrderId())
                    .eq(RefundRecord::getRefundStatus, "pending")
                    .eq(RefundRecord::getDelFlag, 0));
            if (stillPending == null || stillPending == 0) {
                order.setOrderStatus(statusBeforeRefund(order));
                order.setUpdateTime(new Date());
                orderMapper.updateById(order);
            }
        }
        return ApiResponse.success(true);
    }

    /**
     * 订单进入"售后中"之前所处的状态 —— 退款被驳回后要把订单放回这里。
     *
     * <p>订单表没有"上一状态"列，这里按订单自己留下的进度痕迹倒推，口径与
     * /{id}/status 里推进状态时写的字段一致：结算过 → 已完成；买家确认过收货 →
     * 已收货；有物流在走 → 已发货；否则就是已付款待发货。</p>
     */
    private String statusBeforeRefund(TradeOrder order) {
        if ("settled".equals(order.getSettleStatus())) {
            return "completed";
        }
        if (order.getBuyerConfirmed() != null && order.getBuyerConfirmed() == 1) {
            return "received";
        }
        if (order.getLogisticsStatus() != null && !order.getLogisticsStatus().isEmpty()) {
            return "shipped";
        }
        return "paid";
    }

    private String strOr(Object value, String fallback) {
        if (value == null || String.valueOf(value).isBlank()) return fallback;
        return String.valueOf(value);
    }

    private void addLogisticsTrace(Logistics logistics, String status, String location) {
        LogisticsTrace trace = new LogisticsTrace();
        trace.setLogisticsId(logistics.getId());
        trace.setLogisticsNo(logistics.getLogisticsNo());
        trace.setTraceNo("TR" + System.currentTimeMillis());
        trace.setTraceTime(new Date());
        trace.setTraceStatus(status);
        trace.setTraceLocation(location);
        trace.setTraceDescription("picked".equals(status) ? "供应商已发货，物流已揽收"
                : "delivered".equals(status) ? "货物已送达并签收" : status);
        trace.setDelFlag(0);
        trace.setCreateTime(new Date());
        logisticsTraceMapper.insert(trace);
    }

    /**
     * 判权：当前用户的主体必须是这单的买方或卖方。
     *
     * @return 拒绝原因；允许访问时返回 null
     */
    private String denyIfNotParticipant(TradeOrder order) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return scope.error();
        }
        if (!scope.hasBinding()) {
            return "当前账号还没有绑定经营主体，看不到相关单据（请联系运营在「用户-主体绑定」里配置）";
        }
        List<Long> mine = scope.merchantIds();
        if (mine.contains(order.getBuyerId()) || mine.contains(order.getSellerId())) {
            return null;
        }
        // 不区分"不存在"和"无权"以外的细节，也不回显对方的名称/编号 —— 否则这个接口本身
        // 就成了"拿 id 探测别人单据是否存在"的工具。
        return "无权查看该订单";
    }
}
