package com.agri.s2b2c.controller;

import com.agri.s2b2c.entity.Address;
import com.agri.s2b2c.entity.Cart;
import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.entity.ChannelProduct;
import com.agri.s2b2c.entity.Consumer;
import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.mapper.AddressMapper;
import com.agri.s2b2c.mapper.CartMapper;
import com.agri.s2b2c.mapper.ChannelPartnerMapper;
import com.agri.s2b2c.mapper.ChannelProductMapper;
import com.agri.s2b2c.mapper.ProductMapper;
import com.agri.s2b2c.security.CapabilityGuard;
import com.agri.s2b2c.service.ConsumerIdentityService;
import com.agri.s2b2c.service.ConsumerService;
import com.agri.s2b2c.service.GroupBuyService;
import com.agri.s2b2c.service.OrderService;
import com.agri.s2b2c.service.OrderStatus;
import com.agri.s2b2c.service.ProductService;
import com.agri.s2b2c.vo.CartVO;
import com.agri.s2b2c.vo.OrderVO;
import com.agri.s2b2c.vo.ProductVO;
import com.agri.common.rbac.OperatorOnly;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/consumer")
@OperatorOnly("s2b2c:consumer")
public class ConsumerController {

    private final ConsumerService consumerService;
    private final ProductService productService;
    private final OrderService orderService;
    private final AddressMapper addressMapper;
    private final ConsumerIdentityService consumerIdentityService;
    private final CapabilityGuard capabilityGuard;
    private final ChannelPartnerMapper channelPartnerMapper;
    private final ChannelProductMapper channelProductMapper;
    private final ProductMapper productMapper;
    private final CartMapper cartMapper;
    private final GroupBuyService groupBuyService;

    public ConsumerController(ConsumerService consumerService, ProductService productService, OrderService orderService,
                              AddressMapper addressMapper, ConsumerIdentityService consumerIdentityService,
                              CapabilityGuard capabilityGuard,
                              ChannelPartnerMapper channelPartnerMapper,
                              ChannelProductMapper channelProductMapper,
                              ProductMapper productMapper,
                              CartMapper cartMapper,
                              GroupBuyService groupBuyService) {
        this.consumerService = consumerService;
        this.productService = productService;
        this.orderService = orderService;
        this.addressMapper = addressMapper;
        this.consumerIdentityService = consumerIdentityService;
        this.capabilityGuard = capabilityGuard;
        this.channelPartnerMapper = channelPartnerMapper;
        this.channelProductMapper = channelProductMapper;
        this.productMapper = productMapper;
        this.cartMapper = cartMapper;
        this.groupBuyService = groupBuyService;
    }

    /**
     * 渠道店铺：渠道信息 + 该渠道已选中的在架商品。
     *
     * <p>消费者从渠道分享链接进入；商品来自 channel_product 的 ACTIVE 关系，
     * 已撤销或未审核通过的商品不会出现在店铺里。</p>
     */
    @GetMapping("/channel/{channelId}")
    public ResponseEntity<Map<String, Object>> channelShop(@PathVariable Long channelId) {
        ChannelPartner channel = channelPartnerMapper.selectById(channelId);
        if (channel == null || !"APPROVED".equalsIgnoreCase(channel.getAuditStatus())) {
            return ResponseEntity.status(404).body(Map.of("message", "渠道店铺不存在或未开通"));
        }
        List<ChannelProduct> relations = channelProductMapper.selectList(new LambdaQueryWrapper<ChannelProduct>()
                .eq(ChannelProduct::getChannelId, channelId)
                .eq(ChannelProduct::getStatus, "ACTIVE"));
        Map<Long, ChannelProduct> relationByProduct = new java.util.HashMap<>();
        for (ChannelProduct relation : relations) {
            if (relation.getProductId() != null && !"OFF".equalsIgnoreCase(relation.getShelfStatus())) {
                relationByProduct.putIfAbsent(relation.getProductId(), relation);
            }
        }
        List<Long> productIds = new java.util.ArrayList<>(relationByProduct.keySet());
        List<Map<String, Object>> products = new java.util.ArrayList<>();
        if (!productIds.isEmpty()) {
            for (Product product : productMapper.selectList(new LambdaQueryWrapper<Product>()
                    .in(Product::getId, productIds)
                    .eq(Product::getStatus, "APPROVED")
                    .orderByDesc(Product::getUpdateTime))) {
                ChannelProduct relation = relationByProduct.get(product.getId());
                java.math.BigDecimal price = relation != null && relation.getRetailPrice() != null
                        && relation.getRetailPrice().signum() > 0 ? relation.getRetailPrice() : product.getPrice();
                Map<String, Object> row = new HashMap<>();
                row.put("id", product.getId());
                row.put("name", product.getName());
                row.put("price", price);
                row.put("stock", product.getStock());
                row.put("unit", product.getUnit());
                row.put("image", firstImage(product.getImages()));
                row.put("commissionRate", product.getCommissionRate());
                products.add(row);
            }
        }
        Map<String, Object> shop = new HashMap<>();
        shop.put("id", channel.getId());
        shop.put("shopName", channel.getShopName());
        shop.put("shopDesc", channel.getShopDesc());
        shop.put("shopLogo", channel.getShopLogo());
        shop.put("grade", channel.getGrade());
        Map<String, Object> data = new HashMap<>();
        data.put("channel", shop);
        data.put("products", products);
        return ResponseEntity.ok(data);
    }

    /**
     * 渠道店铺发现：只返回审核通过且有在架商品的渠道，供商城首页/移动端入口展示。
     */
    @GetMapping("/channels")
    public ResponseEntity<List<Map<String, Object>>> channels(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "20") int limit) {
        List<ChannelPartner> partners = channelPartnerMapper.selectList(new LambdaQueryWrapper<ChannelPartner>()
                .eq(ChannelPartner::getAuditStatus, "APPROVED"));
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (ChannelPartner channel : partners) {
            if (keyword != null && !keyword.isBlank()
                    && (channel.getShopName() == null || !channel.getShopName().contains(keyword.trim()))) {
                continue;
            }
            List<ChannelProduct> relations = channelProductMapper.selectList(new LambdaQueryWrapper<ChannelProduct>()
                    .eq(ChannelProduct::getChannelId, channel.getId())
                    .eq(ChannelProduct::getStatus, "ACTIVE"));
            int count = 0;
            java.math.BigDecimal minPrice = null;
            String cover = null;
            String featured = null;
            for (ChannelProduct relation : relations) {
                if ("OFF".equalsIgnoreCase(relation.getShelfStatus())) {
                    continue;
                }
                Product product = productMapper.selectById(relation.getProductId());
                if (product == null || !"APPROVED".equals(product.getStatus())) {
                    continue;
                }
                count++;
                java.math.BigDecimal price = relation.getRetailPrice() != null && relation.getRetailPrice().signum() > 0
                        ? relation.getRetailPrice() : product.getPrice();
                if (minPrice == null || (price != null && price.compareTo(minPrice) < 0)) {
                    minPrice = price;
                }
                if (cover == null) {
                    cover = firstImage(product.getImages());
                    featured = product.getName();
                }
            }
            if (count == 0) {
                continue;
            }
            Map<String, Object> item = new HashMap<>();
            item.put("id", channel.getId());
            item.put("shopName", channel.getShopName());
            item.put("shopDesc", channel.getShopDesc());
            item.put("shopLogo", channel.getShopLogo());
            item.put("grade", channel.getGrade());
            item.put("productCount", count);
            item.put("minPrice", minPrice);
            item.put("coverImage", cover);
            item.put("featuredProduct", featured);
            result.add(item);
        }
        result.sort((a, b) -> Integer.compare((int) b.get("productCount"), (int) a.get("productCount")));
        return ResponseEntity.ok(result.size() > limit ? result.subList(0, limit) : result);
    }

    private String firstImage(String images) {
        if (images == null || images.isBlank()) {
            return null;
        }
        String first = images.split(",")[0].trim();
        return first.isEmpty() ? null : first;
    }

    /**
     * 当前登录账号对应的消费者档案（首次访问自动建档/认领老档案）。
     */
    @GetMapping("/profile")
    public ResponseEntity<Map<String, Object>> profile() {
        Consumer me = consumerIdentityService.current();
        Map<String, Object> data = new HashMap<>();
        data.put("id", me.getId());
        data.put("nickname", me.getNickname());
        data.put("phone", me.getPhone());
        data.put("memberLevel", me.getMemberLevel());
        data.put("points", me.getPoints());
        data.put("totalConsume", me.getTotalConsume());
        return ResponseEntity.ok(data);
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Consumer consumer) {
        Map<String, Object> result = new HashMap<>();
        boolean success = consumerService.register(consumer);
        result.put("success", success);
        result.put("message", success ? "注册成功" : "注册失败");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestParam String phone) {
        Map<String, Object> result = new HashMap<>();
        Consumer consumer = consumerService.getByPhone(phone);
        if (consumer != null) {
            result.put("success", true);
            result.put("data", consumer);
        } else {
            Consumer newConsumer = new Consumer();
            newConsumer.setPhone(phone);
            consumerService.register(newConsumer);
            result.put("success", true);
            result.put("data", newConsumer);
            result.put("message", "新用户已自动注册");
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/products")
    public ResponseEntity<IPage<ProductVO>> getProducts(
            @RequestParam(name = "page", defaultValue = "1") Integer page,
            @RequestParam(name = "size", defaultValue = "10") Integer size,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "categoryId", required = false) Long categoryId,
            @RequestParam(name = "sort", required = false) String sort,
            @RequestParam(name = "minPrice", required = false) java.math.BigDecimal minPrice,
            @RequestParam(name = "maxPrice", required = false) java.math.BigDecimal maxPrice) {
        // 商城侧固定只出 APPROVED；排序与价格区间只作用于消费者列表
        return ResponseEntity.ok(productService.pageListForConsumer(page, size, keyword, categoryId, sort, minPrice, maxPrice));
    }

    @GetMapping("/product/detail/{id}")
    public ResponseEntity<ProductVO> getProductDetail(@PathVariable Long id) {
        return ResponseEntity.ok(productService.getDetail(id));
    }

    @GetMapping("/cart")
    public ResponseEntity<List<CartVO>> getCart(@RequestParam Long consumerId) {
        consumerIdentityService.requireSelf(consumerId);
        return ResponseEntity.ok(consumerService.getCart(consumerId));
    }

    @PostMapping("/cart/add")
    public ResponseEntity<Map<String, Object>> addCart(
            @RequestParam Long consumerId,
            @RequestParam Long productId,
            @RequestParam(defaultValue = "1") Integer quantity,
            @RequestParam(required = false) Long channelId) {
        consumerIdentityService.requireSelf(consumerId);
        Map<String, Object> result = new HashMap<>();
        try {
            boolean success = consumerService.addCart(consumerId, productId, quantity, channelId);
            result.put("success", success);
            result.put("message", success ? "加入购物车成功" : "加入购物车失败");
        } catch (IllegalArgumentException e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return ResponseEntity.ok(result);
    }

    /**
     * 改数量 / 改勾选。两个参数至少传一个：前端步进器只传 quantity，勾选框只传 selected。
     */
    @PutMapping("/cart/update")
    public ResponseEntity<Map<String, Object>> updateCart(
            @RequestParam Long id,
            @RequestParam(required = false) Integer quantity,
            @RequestParam(required = false) Boolean selected) {
        consumerIdentityService.requireOwnCartItem(id);
        Map<String, Object> result = new HashMap<>();
        if (quantity == null && selected == null) {
            result.put("success", false);
            result.put("message", "数量和勾选状态至少传一个");
            return ResponseEntity.ok(result);
        }
        boolean success = consumerService.updateCart(id, quantity, selected);
        result.put("success", success);
        return ResponseEntity.ok(result);
    }

    /** 购物车全选/全不选：只影响当前消费者自己的行。 */
    @PutMapping("/cart/select-all")
    public ResponseEntity<Map<String, Object>> selectAllCart(
            @RequestParam Long consumerId,
            @RequestParam Boolean selected) {
        consumerIdentityService.requireSelf(consumerId);
        int updated = cartMapper.update(null, new LambdaUpdateWrapper<Cart>()
                .eq(Cart::getConsumerId, consumerId)
                .set(Cart::getSelected, selected)
                .set(Cart::getUpdateTime, LocalDateTime.now()));
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("updated", updated);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/cart/delete/{id}")
    public ResponseEntity<Map<String, Object>> deleteCart(@PathVariable Long id) {
        consumerIdentityService.requireOwnCartItem(id);
        Map<String, Object> result = new HashMap<>();
        boolean success = consumerService.deleteCart(id);
        result.put("success", success);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/order/create")
    public ResponseEntity<Map<String, Object>> createOrder(@RequestBody Order order) {
        // 下单要 s2b2c.consumer（登录即具备；策略收紧时由平台统一改判定）
        capabilityGuard.require("s2b2c.consumer", "下单");
        // 订单归属以登录账号为准：没传就补当前消费者，传了别人的直接拒绝
        if (order.getConsumerId() == null) {
            order.setConsumerId(consumerIdentityService.current().getId());
        } else {
            consumerIdentityService.requireSelf(order.getConsumerId());
        }
        Map<String, Object> result = new HashMap<>();
        // 拼团订单走团购链路（校验团价、建团/参团、登记成员），普通订单照旧拆单
        java.util.List<Long> orderIds = order.getGroupBuyId() != null
                ? groupBuyService.createGroupOrder(order)
                : orderService.createSplit(order);
        boolean success = orderIds != null && !orderIds.isEmpty();
        result.put("success", success);
        result.put("orderIds", orderIds);
        result.put("orderCount", orderIds == null ? 0 : orderIds.size());
        result.put("message", success
                ? (orderIds.size() > 1 ? "下单成功，已按供应商/渠道拆分为 " + orderIds.size() + " 个订单" : "下单成功")
                : "下单失败");
        if (success) {
            consumerService.clearCart(order.getConsumerId());
        }
        return ResponseEntity.ok(result);
    }

    /** 拼团：进行中的活动（含可参团数），供页面展示「去参团」入口。 */
    @GetMapping("/group-buy/open")
    public ResponseEntity<List<Map<String, Object>>> openGroupBuys() {
        return ResponseEntity.ok(groupBuyService.openActivities());
    }

    /** 拼团：活动详情 + 当前可参团的团列表。 */
    @GetMapping("/group-buy/{id}")
    public ResponseEntity<Map<String, Object>> groupBuyDetail(@PathVariable Long id) {
        Map<String, Object> detail = groupBuyService.detail(id);
        if (detail.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "拼团活动不存在"));
        }
        return ResponseEntity.ok(detail);
    }

    /** 拼团：我参与的团。 */
    @GetMapping("/group-buy/mine")
    public ResponseEntity<List<Map<String, Object>>> myGroupBuys(@RequestParam Long consumerId) {
        consumerIdentityService.requireSelf(consumerId);
        return ResponseEntity.ok(groupBuyService.myGroups(consumerId));
    }

    @GetMapping("/orders")
    public ResponseEntity<IPage<OrderVO>> getOrders(
            @RequestParam Long consumerId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        consumerIdentityService.requireSelf(consumerId);
        return ResponseEntity.ok(orderService.pageList(page, size, consumerId, null, status));
    }

    @GetMapping("/order/detail/{id}")
    public ResponseEntity<OrderVO> getOrderDetail(@PathVariable Long id) {
        consumerIdentityService.requireOwnOrder(id);
        return ResponseEntity.ok(orderService.getDetail(id));
    }

    @PutMapping("/order/pay/{id}")
    public ResponseEntity<Map<String, Object>> payOrder(@PathVariable Long id) {
        consumerIdentityService.requireOwnOrder(id);
        OrderService.StatusResult result = orderService.changeStatus(id, OrderStatus.PENDING_SHIP);
        return ResponseEntity.ok(Map.of("success", result.success(), "message", result.message()));
    }

    /**
     * 确认收货。
     *
     * <p>原先这里直接 {@code updateStatus(id, "COMPLETED")} 且服务端不校验来源状态，
     * <b>待付款的订单也能"收货"</b> —— 而佣金结算与渠道等级都读这个 status，
     * 于是不用付钱就能把渠道佣金做成可结算。现在由 {@link OrderStatus} 的流转表拦：
     * 只有已发货 / 待收货的单子才允许收。</p>
     */
    @PutMapping("/order/receive/{id}")
    public ResponseEntity<Map<String, Object>> receiveOrder(@PathVariable Long id) {
        consumerIdentityService.requireOwnOrder(id);
        OrderService.StatusResult result = orderService.changeStatus(id, OrderStatus.COMPLETED);
        return ResponseEntity.ok(Map.of("success", result.success(), "message", result.message()));
    }

    @GetMapping("/addresses")
    public ResponseEntity<List<Address>> getAddresses(@RequestParam Long consumerId) {
        consumerIdentityService.requireSelf(consumerId);
        LambdaQueryWrapper<Address> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Address::getConsumerId, consumerId);
        wrapper.eq(Address::getStatus, "ACTIVE");
        return ResponseEntity.ok(addressMapper.selectList(wrapper));
    }

    @PostMapping("/address/add")
    public ResponseEntity<Map<String, Object>> addAddress(@RequestBody Address address) {
        // 地址归属以登录账号为准，不信任请求体里的 consumerId
        address.setConsumerId(consumerIdentityService.current().getId());
        Map<String, Object> result = new HashMap<>();
        // isDefault 是 Boolean（请求体不传就是 null），直接 unbox 会 NPE 成 500；按"没勾默认地址"处理
        if (Boolean.TRUE.equals(address.getIsDefault())) {
            LambdaUpdateWrapper<Address> wrapper = new LambdaUpdateWrapper<>();
            wrapper.eq(Address::getConsumerId, address.getConsumerId());
            wrapper.set(Address::getIsDefault, false);
            addressMapper.update(null, wrapper);
        }
        int count = addressMapper.insert(address);
        result.put("success", count > 0);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/address/update")
    public ResponseEntity<Map<String, Object>> updateAddress(@RequestBody Address address) {
        consumerIdentityService.requireOwnAddress(address.getId());
        address.setConsumerId(consumerIdentityService.current().getId());
        Map<String, Object> result = new HashMap<>();
        // isDefault 是 Boolean（请求体不传就是 null），直接 unbox 会 NPE 成 500；按"没勾默认地址"处理
        if (Boolean.TRUE.equals(address.getIsDefault())) {
            LambdaUpdateWrapper<Address> wrapper = new LambdaUpdateWrapper<>();
            wrapper.eq(Address::getConsumerId, address.getConsumerId());
            wrapper.set(Address::getIsDefault, false);
            addressMapper.update(null, wrapper);
        }
        int count = addressMapper.updateById(address);
        result.put("success", count > 0);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/address/delete/{id}")
    public ResponseEntity<Map<String, Object>> deleteAddress(@PathVariable Long id) {
        consumerIdentityService.requireOwnAddress(id);
        Map<String, Object> result = new HashMap<>();
        Address address = addressMapper.selectById(id);
        if (address != null) {
            address.setStatus("DELETED");
            int count = addressMapper.updateById(address);
            result.put("success", count > 0);
        } else {
            result.put("success", false);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/detail/{id}")
    public ResponseEntity<Consumer> getDetail(@PathVariable Long id) {
        consumerIdentityService.requireSelf(id);
        return ResponseEntity.ok(consumerService.getById(id));
    }

    @PutMapping("/update")
    public ResponseEntity<Map<String, Object>> updateInfo(@RequestBody Consumer consumer) {
        consumerIdentityService.requireSelf(consumer.getId());
        Map<String, Object> result = new HashMap<>();
        boolean success = consumerService.updateInfo(consumer);
        result.put("success", success);
        return ResponseEntity.ok(result);
    }
}
