package com.agri.s2b2c.controller;

import com.agri.s2b2c.entity.Address;
import com.agri.s2b2c.entity.Consumer;
import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.mapper.AddressMapper;
import com.agri.s2b2c.service.ConsumerService;
import com.agri.s2b2c.service.OrderService;
import com.agri.s2b2c.service.ProductService;
import com.agri.s2b2c.vo.CartVO;
import com.agri.s2b2c.vo.OrderVO;
import com.agri.s2b2c.vo.ProductVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/consumer")
public class ConsumerController {

    private final ConsumerService consumerService;
    private final ProductService productService;
    private final OrderService orderService;
    private final AddressMapper addressMapper;

    public ConsumerController(ConsumerService consumerService, ProductService productService, OrderService orderService, AddressMapper addressMapper) {
        this.consumerService = consumerService;
        this.productService = productService;
        this.orderService = orderService;
        this.addressMapper = addressMapper;
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
            @RequestParam(name = "categoryId", required = false) Long categoryId) {
        return ResponseEntity.ok(productService.pageList(page, size, keyword, categoryId, null, "APPROVED"));
    }

    @GetMapping("/product/detail/{id}")
    public ResponseEntity<ProductVO> getProductDetail(@PathVariable Long id) {
        return ResponseEntity.ok(productService.getDetail(id));
    }

    @GetMapping("/cart")
    public ResponseEntity<List<CartVO>> getCart(@RequestParam Long consumerId) {
        return ResponseEntity.ok(consumerService.getCart(consumerId));
    }

    @PostMapping("/cart/add")
    public ResponseEntity<Map<String, Object>> addCart(
            @RequestParam Long consumerId,
            @RequestParam Long productId,
            @RequestParam(defaultValue = "1") Integer quantity) {
        Map<String, Object> result = new HashMap<>();
        boolean success = consumerService.addCart(consumerId, productId, quantity);
        result.put("success", success);
        result.put("message", success ? "加入购物车成功" : "加入购物车失败");
        return ResponseEntity.ok(result);
    }

    @PutMapping("/cart/update")
    public ResponseEntity<Map<String, Object>> updateCart(
            @RequestParam Long id,
            @RequestParam Integer quantity) {
        Map<String, Object> result = new HashMap<>();
        boolean success = consumerService.updateCart(id, quantity);
        result.put("success", success);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/cart/delete/{id}")
    public ResponseEntity<Map<String, Object>> deleteCart(@PathVariable Long id) {
        Map<String, Object> result = new HashMap<>();
        boolean success = consumerService.deleteCart(id);
        result.put("success", success);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/order/create")
    public ResponseEntity<Map<String, Object>> createOrder(@RequestBody Order order) {
        Map<String, Object> result = new HashMap<>();
        boolean success = orderService.create(order);
        result.put("success", success);
        result.put("message", success ? "下单成功" : "下单失败");
        if (success) {
            consumerService.clearCart(order.getConsumerId());
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/orders")
    public ResponseEntity<IPage<OrderVO>> getOrders(
            @RequestParam Long consumerId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(orderService.pageList(page, size, consumerId, null, status));
    }

    @GetMapping("/order/detail/{id}")
    public ResponseEntity<OrderVO> getOrderDetail(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.getDetail(id));
    }

    @PutMapping("/order/pay/{id}")
    public ResponseEntity<Map<String, Object>> payOrder(@PathVariable Long id) {
        Map<String, Object> result = new HashMap<>();
        boolean success = orderService.updateStatus(id, "PENDING_SHIP");
        result.put("success", success);
        result.put("message", success ? "支付成功" : "支付失败");
        return ResponseEntity.ok(result);
    }

    @PutMapping("/order/receive/{id}")
    public ResponseEntity<Map<String, Object>> receiveOrder(@PathVariable Long id) {
        Map<String, Object> result = new HashMap<>();
        boolean success = orderService.updateStatus(id, "COMPLETED");
        result.put("success", success);
        result.put("message", success ? "收货成功" : "操作失败");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/addresses")
    public ResponseEntity<List<Address>> getAddresses(@RequestParam Long consumerId) {
        LambdaQueryWrapper<Address> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Address::getConsumerId, consumerId);
        wrapper.eq(Address::getStatus, "ACTIVE");
        return ResponseEntity.ok(addressMapper.selectList(wrapper));
    }

    @PostMapping("/address/add")
    public ResponseEntity<Map<String, Object>> addAddress(@RequestBody Address address) {
        Map<String, Object> result = new HashMap<>();
        if (address.getIsDefault()) {
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
        Map<String, Object> result = new HashMap<>();
        if (address.getIsDefault()) {
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
        return ResponseEntity.ok(consumerService.getById(id));
    }

    @PutMapping("/update")
    public ResponseEntity<Map<String, Object>> updateInfo(@RequestBody Consumer consumer) {
        Map<String, Object> result = new HashMap<>();
        boolean success = consumerService.updateInfo(consumer);
        result.put("success", success);
        return ResponseEntity.ok(result);
    }
}