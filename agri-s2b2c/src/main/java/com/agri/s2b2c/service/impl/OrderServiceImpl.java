package com.agri.s2b2c.service.impl;

import com.agri.s2b2c.entity.Address;
import com.agri.s2b2c.entity.Cart;
import com.agri.s2b2c.entity.ChannelProduct;
import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.entity.Commission;
import com.agri.s2b2c.entity.CommissionRule;
import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.service.OrderStatus;
import com.agri.s2b2c.entity.OrderItem;
import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.mapper.AddressMapper;
import com.agri.s2b2c.mapper.CartMapper;
import com.agri.s2b2c.mapper.ChannelPartnerMapper;
import com.agri.s2b2c.mapper.ChannelProductMapper;
import com.agri.s2b2c.mapper.CommissionRuleMapper;
import com.agri.s2b2c.mapper.CommissionMapper;
import com.agri.s2b2c.mapper.OrderItemMapper;
import com.agri.s2b2c.mapper.OrderMapper;
import com.agri.s2b2c.mapper.ProductMapper;
import com.agri.s2b2c.service.ActivityBudgetService;
import com.agri.s2b2c.service.ActivityPriceService;
import com.agri.s2b2c.service.DistributionRuleService;
import com.agri.s2b2c.service.NoticeService;
import com.agri.s2b2c.service.OrderService;
import com.agri.s2b2c.vo.AddressVO;
import com.agri.s2b2c.vo.OrderItemVO;
import com.agri.s2b2c.vo.OrderVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.BeanUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class OrderServiceImpl extends ServiceImpl<OrderMapper, Order> implements OrderService {

    private final OrderItemMapper orderItemMapper;
    private final AddressMapper addressMapper;
    private final CartMapper cartMapper;
    private final ChannelProductMapper channelProductMapper;
    private final ChannelPartnerMapper channelPartnerMapper;
    private final CommissionRuleMapper commissionRuleMapper;
    private final ProductMapper productMapper;
    private final CommissionMapper commissionMapper;
    private final ActivityPriceService activityPriceService;
    private final NoticeService noticeService;
    private final DistributionRuleService distributionRuleService;
    private final ActivityBudgetService activityBudgetService;
    private final JdbcTemplate jdbc;

    // 状态词表与中文文案的唯一来源是 OrderStatus（含"哪些状态算已支付"），这里不再各写一份

    public OrderServiceImpl(OrderItemMapper orderItemMapper, AddressMapper addressMapper,
                            CartMapper cartMapper, ChannelProductMapper channelProductMapper,
                            ChannelPartnerMapper channelPartnerMapper, CommissionRuleMapper commissionRuleMapper,
                            ProductMapper productMapper, CommissionMapper commissionMapper,
                            ActivityPriceService activityPriceService, NoticeService noticeService,
                            DistributionRuleService distributionRuleService,
                            ActivityBudgetService activityBudgetService, JdbcTemplate jdbc) {
        this.orderItemMapper = orderItemMapper;
        this.addressMapper = addressMapper;
        this.cartMapper = cartMapper;
        this.channelProductMapper = channelProductMapper;
        this.channelPartnerMapper = channelPartnerMapper;
        this.commissionRuleMapper = commissionRuleMapper;
        this.productMapper = productMapper;
        this.commissionMapper = commissionMapper;
        this.activityPriceService = activityPriceService;
        this.noticeService = noticeService;
        this.distributionRuleService = distributionRuleService;
        this.activityBudgetService = activityBudgetService;
        this.jdbc = jdbc;
    }

    @Override
    public OrderVO getDetail(Long id) {
        Order order = baseMapper.selectById(id);
        return convertToVO(order);
    }

    @Override
    public IPage<OrderVO> pageList(int page, int size, Long consumerId, Long shopId, String status) {
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        if (consumerId != null) {
            wrapper.eq(Order::getConsumerId, consumerId);
        }
        if (shopId != null) {
            wrapper.eq(Order::getShopId, shopId);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Order::getStatus, status);
        }
        wrapper.orderByDesc(Order::getCreateTime);

        Page<Order> pageQuery = new Page<>(page, size);
        IPage<Order> pageResult = baseMapper.selectPage(pageQuery, wrapper);

        return pageResult.convert(this::convertToVO);
    }

    @Override
    @Transactional
    public boolean create(Order order) {
        return !createSplit(order).isEmpty();
    }

    /**
     * 拆单：按「渠道 + 供应商」分组，每组一张订单。
     *
     * <p>渠道归属规则：请求带 channelId 时，只有**在该渠道选品清单里**的商品记到渠道订单；
     * 其余商品仍可下单，但归入直购订单（channelId 为空）。这样渠道店铺可以放心让用户
     * 把渠道商品和普通商品一起结算，而不是整单被拒。</p>
     *
     * <p>运费只算在第一批；优惠按金额比例分摊，最后一批兜底差额，保证合计不变。</p>
     */
    @Override
    @Transactional
    public List<Long> createSplit(Order order) {
        if (order == null || order.getConsumerId() == null || order.getAddressId() == null) {
            throw new IllegalArgumentException("缺少消费者或收货地址");
        }
        Address address = addressMapper.selectById(order.getAddressId());
        if (address == null || !order.getConsumerId().equals(address.getConsumerId())) {
            throw new IllegalArgumentException("收货地址不存在或不属于当前消费者");
        }
        List<Cart> carts = cartMapper.selectList(new LambdaQueryWrapper<Cart>()
                .eq(Cart::getConsumerId, order.getConsumerId())
                .eq(Cart::getSelected, true));
        if (carts.isEmpty()) {
            throw new IllegalArgumentException("购物车中没有选中商品");
        }

        record Line(Cart cart, Product product, int quantity, BigDecimal unitPrice, BigDecimal amount,
                    Long channelId, Long supplierId, Long flashId, BigDecimal flashSubsidy) {
        }
        Long requestedChannel = order.getChannelId();
        List<Line> lines = new java.util.ArrayList<>();
        for (Cart cart : carts) {
            Product product = productMapper.selectById(cart.getProductId());
            if (product == null || !"APPROVED".equals(product.getStatus())) {
                throw new IllegalArgumentException("购物车中存在已下架商品");
            }
            int quantity = cart.getQuantity() == null ? 0 : cart.getQuantity();
            if (quantity <= 0 || product.getStock() == null || product.getStock() < quantity) {
                throw new IllegalArgumentException(product.getName() + " 库存不足");
            }
            // 行级渠道优先（从渠道店铺加购的商品）；没有再用请求级 channelId
            Long channelId = null;
            Long lineChannel = cart.getChannelId();
            if (lineChannel != null) {
                Long picked = channelProductMapper.selectCount(new LambdaQueryWrapper<ChannelProduct>()
                        .eq(ChannelProduct::getChannelId, lineChannel)
                        .eq(ChannelProduct::getProductId, product.getId())
                        .eq(ChannelProduct::getStatus, "ACTIVE"));
                if (picked == null || picked == 0) {
                    throw new IllegalArgumentException("购物车中「" + product.getName()
                            + "」所在渠道已下架该商品，请先在购物车中移除后再结算");
                }
                channelId = lineChannel;
            } else if (requestedChannel != null) {
                Long picked = channelProductMapper.selectCount(new LambdaQueryWrapper<ChannelProduct>()
                        .eq(ChannelProduct::getChannelId, requestedChannel)
                        .eq(ChannelProduct::getProductId, product.getId())
                        .eq(ChannelProduct::getStatus, "ACTIVE"));
                if (picked != null && picked > 0) {
                    channelId = requestedChannel;
                }
            }
            /*
             * 单价：渠道商品按渠道零售价（没设则按商品价）；活动期内按秒杀价，其余按上述价格。
             * 超出个人限购不去阻断下单，而是退回原价 —— 用户把商品留在购物车跨场次结算时，
             * 直接报错会让人卡死；但活动库存不足必须抛错，否则就是超卖。
             */
            ChannelProduct lineRelation = null;
            if (channelId != null) {
                lineRelation = channelProductMapper.selectOne(new LambdaQueryWrapper<ChannelProduct>()
                        .eq(ChannelProduct::getChannelId, channelId)
                        .eq(ChannelProduct::getProductId, product.getId())
                        .last("LIMIT 1"));
                if (lineRelation == null || !"ACTIVE".equals(lineRelation.getStatus())) {
                    throw new IllegalArgumentException("购物车中「" + product.getName()
                            + "」所在渠道已下架该商品，请先在购物车中移除后再结算");
                }
                if ("OFF".equalsIgnoreCase(lineRelation.getShelfStatus())) {
                    throw new IllegalArgumentException("购物车中「" + product.getName()
                            + "」已在渠道店铺下架，请先在购物车中移除后再结算");
                }
                distributionRuleService.assertRegionAllowed(product, address.getProvince());
            }
            BigDecimal unitPrice = lineRelation != null && lineRelation.getRetailPrice() != null
                    && lineRelation.getRetailPrice().signum() > 0
                    ? lineRelation.getRetailPrice() : product.getPrice();
            Long flashId = null;
            BigDecimal flashSubsidy = BigDecimal.ZERO;
            ActivityPriceService.Flash flash = order.getGroupUnitPrice() == null
                    ? activityPriceService.activeFlash(product.getId()) : null;
            if (flash != null) {
                int bought = activityPriceService.purchasedQuantity(product.getId(), order.getConsumerId(), flash.startTime());
                boolean withinLimit = flash.perUserLimit() <= 0 || bought + quantity <= flash.perUserLimit();
                if (withinLimit) {
                    if (flash.remainStock() < quantity) {
                        throw new IllegalArgumentException(product.getName() + " 秒杀库存不足，仅剩 " + flash.remainStock() + " 件");
                    }
                    // 预算原子预占；预算不足时不报错，按原价成交，避免用户卡在结算页
                    BigDecimal subsidy = flash.originalPrice() == null ? BigDecimal.ZERO
                            : flash.originalPrice().subtract(flash.price()).max(BigDecimal.ZERO)
                            .multiply(BigDecimal.valueOf(quantity));
                    if (subsidy.signum() <= 0 || activityBudgetService.reserve("FLASH", flash.id(), subsidy)) {
                        unitPrice = flash.price();
                        flashId = flash.id();
                        flashSubsidy = subsidy;
                    }
                }
            }
            if (order.getGroupUnitPrice() != null) {
                // 拼团订单：价格由 GroupBuyService 按团长价/团价算好，秒杀价不参与叠加
                unitPrice = order.getGroupUnitPrice();
            }
            lines.add(new Line(cart, product, quantity, unitPrice,
                    unitPrice.multiply(BigDecimal.valueOf(quantity)), channelId, product.getSupplierId(),
                    flashId, flashSubsidy));
        }

        // 分组键：渠道 + 供应商（同一组合并为一单）
        java.util.LinkedHashMap<String, List<Line>> groups = new java.util.LinkedHashMap<>();
        for (Line line : lines) {
            String key = (line.channelId() == null ? "0" : String.valueOf(line.channelId()))
                    + "|" + (line.supplierId() == null ? "0" : String.valueOf(line.supplierId()));
            groups.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(line);
        }

        BigDecimal totalAll = lines.stream().map(Line::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        // 优惠只能由服务端按券计算；客户端传的 discountAmount 不再采信
        CouponUsage coupon = resolveCoupon(order, totalAll);
        BigDecimal freightTotal = order.getFreightAmount() == null
                ? BigDecimal.ZERO : order.getFreightAmount().max(BigDecimal.ZERO);
        BigDecimal discountTotal = coupon == null ? BigDecimal.ZERO : coupon.discount();
        BigDecimal allocatedDiscount = BigDecimal.ZERO;
        List<Long> orderIds = new java.util.ArrayList<>();
        int index = 0;
        int groupCount = groups.size();
        for (List<Line> group : groups.values()) {
            index++;
            BigDecimal groupTotal = group.stream().map(Line::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal freight = index == 1 ? freightTotal : BigDecimal.ZERO;
            BigDecimal discount;
            if (index == groupCount) {
                // 最后一批兜底差额，保证各单优惠合计等于订单优惠
                discount = discountTotal.subtract(allocatedDiscount).max(BigDecimal.ZERO);
            } else if (totalAll.signum() == 0) {
                discount = BigDecimal.ZERO;
            } else {
                discount = discountTotal.multiply(groupTotal)
                        .divide(totalAll, 2, java.math.RoundingMode.HALF_UP);
                allocatedDiscount = allocatedDiscount.add(discount);
            }
            Line first = group.get(0);
            Order sub = new Order();
            sub.setConsumerId(order.getConsumerId());
            sub.setAddressId(order.getAddressId());
            sub.setPayMethod(order.getPayMethod());
            sub.setDeliveryType(order.getDeliveryType());
            sub.setDeliveryTime(order.getDeliveryTime());
            sub.setRemark(order.getRemark());
            sub.setGroupBuyId(order.getGroupBuyId());
            sub.setGroupInstanceId(order.getGroupInstanceId());
            sub.setGroupSubsidy(order.getGroupSubsidy());
            sub.setOrderNo("ORD" + System.currentTimeMillis() + "-" + index);
            sub.setStatus("PENDING_PAY");
            sub.setCreateTime(LocalDateTime.now());
            sub.setUpdateTime(LocalDateTime.now());
            sub.setSupplierId(first.supplierId());
            sub.setChannelId(first.channelId());
            sub.setShopId(first.cart().getShopId() != null ? first.cart().getShopId() : first.supplierId());
            sub.setTotalAmount(groupTotal);
            sub.setFreightAmount(freight);
            sub.setDiscountAmount(discount);
            sub.setCouponUserId(coupon == null ? null : coupon.couponUserId());
            sub.setCouponDiscount(discount);
            sub.setPayAmount(groupTotal.add(freight).subtract(discount).max(BigDecimal.ZERO));
            if (!save(sub)) {
                throw new IllegalStateException("订单创建失败");
            }
            orderIds.add(sub.getId());

            for (Line line : group) {
                Cart cart = line.cart();
                Product product = line.product();
                int quantity = line.quantity();
                OrderItem item = new OrderItem();
                item.setOrderId(sub.getId());
                item.setProductId(product.getId());
                item.setSkuId(cart.getSkuId());
                item.setName(product.getName());
                item.setSpec(product.getSpec());
                item.setPrice(line.unitPrice());
                item.setSupplyPrice(product.getPrice());
                item.setQuantity(quantity);
                item.setTotalAmount(line.amount());
                item.setImage(firstImage(product.getImages()));
                item.setFlashSaleId(line.flashId());
                item.setFlashSubsidy(line.flashSubsidy());
                item.setCreateTime(LocalDateTime.now());
                orderItemMapper.insert(item);

                if (line.flashId() != null && !activityPriceService.deductStock(line.flashId(), quantity)) {
                    throw new IllegalStateException("秒杀库存已被抢完，请重新下单");
                }

                product.setStock(product.getStock() - quantity);
                product.setSales((product.getSales() == null ? 0 : product.getSales()) + quantity);
                product.setUpdateTime(LocalDateTime.now());
                productMapper.updateById(product);

                if (sub.getChannelId() != null) {
                    // 渠道等级规则优先；没有规则或规则停用时回落到商品自带的佣金率
                    BigDecimal rate = resolveChannelRate(sub.getChannelId(), product.getCommissionRate());
                    if (rate != null) {
                        Commission commission = new Commission();
                        commission.setOrderId(sub.getId());
                        commission.setChannelId(sub.getChannelId());
                        commission.setRate(rate);
                        commission.setAmount(item.getTotalAmount().multiply(rate)
                                .divide(new BigDecimal("100"), 2, java.math.RoundingMode.HALF_UP));
                        commission.setStatus("PENDING");
                        commission.setCreateTime(LocalDateTime.now());
                        commissionMapper.insert(commission);
                    }
                }
            }
            if (sub.getSupplierId() != null) {
                noticeService.notify("SUPPLIER", sub.getSupplierId(), "ORDER_CREATED", "新分销订单",
                        "订单 " + sub.getOrderNo() + "，实付 ¥" + (sub.getPayAmount() == null ? "0" : sub.getPayAmount())
                                + "，请及时发货", "ORDER", sub.getId());
            }
            if (sub.getChannelId() != null) {
                noticeService.notify("CHANNEL", sub.getChannelId(), "ORDER_CREATED", "新渠道订单",
                        "订单 " + sub.getOrderNo() + " 已创建", "ORDER", sub.getId());
            }
        }
        if (coupon != null) {
            int used = jdbc.update("UPDATE s2b2c_coupon_user SET status = 'USED', order_id = ?, use_time = NOW() "
                            + "WHERE id = ? AND consumer_id = ? AND status = 'UNUSED'",
                    orderIds.get(0), coupon.couponUserId(), order.getConsumerId());
            if (used == 0) {
                throw new IllegalArgumentException("优惠券已被使用，请重新选择");
            }
        }
        return orderIds;
    }

    private record CouponUsage(Long couponUserId, Long couponId, BigDecimal discount) {
    }

    /**
     * 校验并计算券优惠。
     *
     * <p>折扣率按「折」存储（0-10，9.5 = 95 折，即支付 95%）；优惠上限为商品合计。
     * 客户端只传 couponUserId，优惠金额一律由服务端重算。</p>
     */
    private CouponUsage resolveCoupon(Order order, BigDecimal goodsTotal) {
        if (order.getCouponUserId() == null) return null;
        if (order.getGroupBuyId() != null) {
            throw new IllegalArgumentException("拼团订单不能叠加优惠券");
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT cu.id, cu.consumer_id AS consumerId, cu.status AS userStatus, "
                        + "c.id AS couponId, c.type, c.amount, c.discount_rate AS discountRate, "
                        + "c.min_amount AS minAmount, c.valid_start AS validStart, c.valid_end AS validEnd, "
                        + "c.status AS couponStatus FROM s2b2c_coupon_user cu "
                        + "JOIN s2b2c_coupon c ON c.id = cu.coupon_id WHERE cu.id = ?", order.getCouponUserId());
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("优惠券不存在");
        }
        Map<String, Object> row = rows.get(0);
        if (!String.valueOf(order.getConsumerId()).equals(String.valueOf(row.get("consumerId")))) {
            throw new IllegalArgumentException("优惠券不属于当前消费者");
        }
        if (!"UNUSED".equalsIgnoreCase(String.valueOf(row.get("userStatus")))) {
            throw new IllegalArgumentException("优惠券已使用或已失效");
        }
        if (!"ACTIVE".equalsIgnoreCase(String.valueOf(row.get("couponStatus")))) {
            throw new IllegalArgumentException("优惠券已停用");
        }
        LocalDate today = LocalDate.now();
        LocalDate validStart = toLocalDate(row.get("validStart"));
        LocalDate validEnd = toLocalDate(row.get("validEnd"));
        if (validStart != null && today.isBefore(validStart)) {
            throw new IllegalArgumentException("优惠券尚未生效");
        }
        if (validEnd != null && today.isAfter(validEnd)) {
            throw new IllegalArgumentException("优惠券已过期");
        }
        BigDecimal goods = goodsTotal == null ? BigDecimal.ZERO : goodsTotal;
        BigDecimal minAmount = decimal(row.get("minAmount"));
        if (goods.compareTo(minAmount) < 0) {
            throw new IllegalArgumentException("订单商品金额未达到优惠券使用门槛 ¥" + minAmount.toPlainString());
        }
        BigDecimal discount;
        if ("DISCOUNT".equalsIgnoreCase(String.valueOf(row.get("type")))) {
            BigDecimal rate = decimal(row.get("discountRate"));
            if (rate.signum() <= 0 || rate.compareTo(BigDecimal.TEN) >= 0) {
                throw new IllegalArgumentException("优惠券折扣配置无效");
            }
            BigDecimal payRatio = BigDecimal.ONE.subtract(
                    rate.divide(BigDecimal.TEN, 6, java.math.RoundingMode.HALF_UP));
            discount = goods.multiply(payRatio).setScale(2, java.math.RoundingMode.HALF_UP);
        } else {
            discount = decimal(row.get("amount"));
        }
        discount = discount.min(goods);
        if (discount.signum() <= 0) {
            throw new IllegalArgumentException("优惠券优惠金额为 0，无法使用");
        }
        Long couponId = ((Number) row.get("couponId")).longValue();
        if (!activityBudgetService.reserve("COUPON", couponId, discount)) {
            throw new IllegalArgumentException("该优惠券活动预算已用完");
        }
        return new CouponUsage(((Number) row.get("id")).longValue(), couponId, discount);
    }

    private BigDecimal decimal(Object value) {
        return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value));
    }

    private LocalDate toLocalDate(Object value) {
        if (value == null) return null;
        if (value instanceof java.sql.Date date) return date.toLocalDate();
        if (value instanceof LocalDate date) return date;
        String text = String.valueOf(value);
        return LocalDate.parse(text.length() > 10 ? text.substring(0, 10) : text);
    }

    /** 渠道等级对应的佣金比例；无 ACTIVE 规则时返回商品自带比例。 */
    private BigDecimal resolveChannelRate(Long channelId, BigDecimal productRate) {
        ChannelPartner channel = channelId == null ? null : channelPartnerMapper.selectById(channelId);
        if (channel != null && channel.getGrade() != null) {
            CommissionRule rule = commissionRuleMapper.selectOne(new LambdaQueryWrapper<CommissionRule>()
                    .eq(CommissionRule::getGrade, channel.getGrade())
                    .eq(CommissionRule::getStatus, "ACTIVE")
                    .last("LIMIT 1"));
            if (rule != null && rule.getRate() != null) {
                return rule.getRate();
            }
        }
        return productRate;
    }

    @Override
    public StatusResult changeStatus(Long id, String target) {
        Order order = baseMapper.selectById(id);
        if (order == null) return new StatusResult(false, "订单不存在");
        if (!OrderStatus.known(target)) {
            return new StatusResult(false, "订单状态不合法：" + target);
        }
        String from = order.getStatus();
        if (!OrderStatus.canTransition(from, target)) {
            // 拒绝要说得出当前卡在哪一档：只回 false 的表现是"按钮点了没反应"，用户只会反复点
            return new StatusResult(false, OrderStatus.rejectReason(from, target));
        }
        /*
         * 时间戳只落在语义对应的字段上：
         * - 转入 PENDING_SHIP 表示「支付完成」→ 写 pay_time，且只允许从待付款流转（重复支付不能刷新时间）；
         * - 原实现在这一步写 delivery_time、在 COMPLETED 写 pay_time，会让订单详情出现
         *   「已付款但付款时间为空」「确认收货才有付款时间」这类自相矛盾的展示，一并纠正。
         */
        if (OrderStatus.PENDING_SHIP.equals(target)) {
            order.setPayTime(LocalDateTime.now());
        }
        order.setStatus(target);
        order.setUpdateTime(LocalDateTime.now());
        updateById(order);
        return new StatusResult(true, "订单已置为「" + OrderStatus.label(target) + "」");
    }

    private OrderVO convertToVO(Order order) {
        if (order == null) return null;
        OrderVO vo = new OrderVO();
        BeanUtils.copyProperties(order, vo);
        vo.setStatusText(OrderStatus.label(order.getStatus()));

        LambdaQueryWrapper<OrderItem> itemWrapper = new LambdaQueryWrapper<>();
        itemWrapper.eq(OrderItem::getOrderId, order.getId());
        List<OrderItem> items = orderItemMapper.selectList(itemWrapper);
        vo.setItems(items.stream().map(this::convertItemToVO).toList());

        Address address = addressMapper.selectById(order.getAddressId());
        if (address != null) {
            AddressVO addressVO = new AddressVO();
            BeanUtils.copyProperties(address, addressVO);
            vo.setAddress(addressVO);
        }

        return vo;
    }

    private OrderItemVO convertItemToVO(OrderItem item) {
        OrderItemVO vo = new OrderItemVO();
        BeanUtils.copyProperties(item, vo);
        return vo;
    }

    private String firstImage(String images) {
        if (images == null || images.isBlank()) return "";
        int start = images.indexOf("\"");
        int end = start < 0 ? -1 : images.indexOf("\"", start + 1);
        return start >= 0 && end > start ? images.substring(start + 1, end) : "";
    }
}
