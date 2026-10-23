package com.agri.s2b2c.controller;

import com.agri.s2b2c.entity.*;
import com.agri.s2b2c.mapper.*;
import com.agri.s2b2c.service.CategoryService;
import com.agri.s2b2c.vo.CategoryVO;
import com.agri.s2b2c.vo.ProductVO;
import com.agri.s2b2c.vo.SupplierVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/platform")
public class PlatformController {

    private final SupplierMapper supplierMapper;
    private final ChannelPartnerMapper channelPartnerMapper;
    private final ProductMapper productMapper;
    private final OrderMapper orderMapper;
    private final CategoryService categoryService;
    private final ConsumerMapper consumerMapper;

    public PlatformController(SupplierMapper supplierMapper, ChannelPartnerMapper channelPartnerMapper,
                              ProductMapper productMapper, OrderMapper orderMapper,
                              CategoryService categoryService, ConsumerMapper consumerMapper) {
        this.supplierMapper = supplierMapper;
        this.channelPartnerMapper = channelPartnerMapper;
        this.productMapper = productMapper;
        this.orderMapper = orderMapper;
        this.categoryService = categoryService;
        this.consumerMapper = consumerMapper;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard() {
        Map<String, Object> result = new HashMap<>();

        long supplierCount = supplierMapper.selectCount(null);
        long channelCount = channelPartnerMapper.selectCount(null);
        long productCount = productMapper.selectCount(null);
        long orderCount = orderMapper.selectCount(null);
        long consumerCount = consumerMapper.selectCount(null);

        BigDecimal totalAmount = orderMapper.selectList(null).stream()
                .map(Order::getPayAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        result.put("supplierCount", supplierCount);
        result.put("channelCount", channelCount);
        result.put("productCount", productCount);
        result.put("orderCount", orderCount);
        result.put("consumerCount", consumerCount);
        result.put("totalAmount", totalAmount);

        return ResponseEntity.ok(result);
    }

    @GetMapping("/suppliers")
    public ResponseEntity<IPage<SupplierVO>> getSuppliers(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String auditStatus) {
        LambdaQueryWrapper<Supplier> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(Supplier::getCompanyName, keyword);
        }
        if (auditStatus != null && !auditStatus.isEmpty()) {
            wrapper.eq(Supplier::getAuditStatus, auditStatus);
        }
        wrapper.orderByDesc(Supplier::getCreateTime);

        Page<Supplier> pageQuery = new Page<>(page, size);
        IPage<Supplier> pageResult = supplierMapper.selectPage(pageQuery, wrapper);

        return ResponseEntity.ok(pageResult.convert(s -> {
            SupplierVO vo = new SupplierVO();
            org.springframework.beans.BeanUtils.copyProperties(s, vo);
            return vo;
        }));
    }

    @GetMapping("/supplier/detail/{id}")
    public ResponseEntity<Supplier> getSupplierDetail(@PathVariable Long id) {
        return ResponseEntity.ok(supplierMapper.selectById(id));
    }

    @PutMapping("/supplier/audit")
    public ResponseEntity<Map<String, Object>> auditSupplier(
            @RequestParam Long id,
            @RequestParam String auditStatus,
            @RequestParam(required = false) String auditOpinion) {
        Map<String, Object> result = new HashMap<>();
        Supplier supplier = supplierMapper.selectById(id);
        if (supplier != null) {
            supplier.setAuditStatus(auditStatus);
            supplier.setAuditOpinion(auditOpinion);
            supplier.setAuditTime(LocalDateTime.now());
            supplier.setUpdateTime(LocalDateTime.now());
            int count = supplierMapper.updateById(supplier);
            result.put("success", count > 0);
        } else {
            result.put("success", false);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/channel-partners")
    public ResponseEntity<IPage<ChannelPartner>> getChannelPartners(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String auditStatus) {
        LambdaQueryWrapper<ChannelPartner> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(ChannelPartner::getCompanyName, keyword);
        }
        if (auditStatus != null && !auditStatus.isEmpty()) {
            wrapper.eq(ChannelPartner::getAuditStatus, auditStatus);
        }
        wrapper.orderByDesc(ChannelPartner::getCreateTime);

        Page<ChannelPartner> pageQuery = new Page<>(page, size);
        return ResponseEntity.ok(channelPartnerMapper.selectPage(pageQuery, wrapper));
    }

    @GetMapping("/channel-partner/detail/{id}")
    public ResponseEntity<ChannelPartner> getChannelPartnerDetail(@PathVariable Long id) {
        return ResponseEntity.ok(channelPartnerMapper.selectById(id));
    }

    @PutMapping("/channel-partner/audit")
    public ResponseEntity<Map<String, Object>> auditChannelPartner(
            @RequestParam Long id,
            @RequestParam String auditStatus,
            @RequestParam(required = false) String auditOpinion) {
        Map<String, Object> result = new HashMap<>();
        ChannelPartner partner = channelPartnerMapper.selectById(id);
        if (partner != null) {
            partner.setAuditStatus(auditStatus);
            partner.setAuditOpinion(auditOpinion);
            partner.setAuditTime(LocalDateTime.now());
            partner.setUpdateTime(LocalDateTime.now());
            int count = channelPartnerMapper.updateById(partner);
            result.put("success", count > 0);
        } else {
            result.put("success", false);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/products")
    public ResponseEntity<IPage<ProductVO>> getProducts(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(Product::getName, keyword);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Product::getStatus, status);
        }
        wrapper.orderByDesc(Product::getCreateTime);

        Page<Product> pageQuery = new Page<>(page, size);
        IPage<Product> pageResult = productMapper.selectPage(pageQuery, wrapper);

        return ResponseEntity.ok(pageResult.convert(p -> {
            ProductVO vo = new ProductVO();
            org.springframework.beans.BeanUtils.copyProperties(p, vo);
            return vo;
        }));
    }

    @GetMapping("/product/detail/{id}")
    public ResponseEntity<Product> getProductDetail(@PathVariable Long id) {
        return ResponseEntity.ok(productMapper.selectById(id));
    }

    @PutMapping("/product/audit")
    public ResponseEntity<Map<String, Object>> auditProduct(
            @RequestParam Long id,
            @RequestParam String status,
            @RequestParam(required = false) String opinion) {
        Map<String, Object> result = new HashMap<>();
        Product product = productMapper.selectById(id);
        if (product != null) {
            product.setStatus(status);
            product.setAuditOpinion(opinion);
            product.setAuditTime(LocalDateTime.now());
            product.setUpdateTime(LocalDateTime.now());
            int count = productMapper.updateById(product);
            result.put("success", count > 0);
        } else {
            result.put("success", false);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/categories")
    public ResponseEntity<List<CategoryVO>> getCategories() {
        return ResponseEntity.ok(categoryService.getTree());
    }

    @PostMapping("/category/add")
    public ResponseEntity<Map<String, Object>> addCategory(@RequestBody Category category) {
        Map<String, Object> result = new HashMap<>();
        category.setStatus("ACTIVE");
        int count = categoryService.getBaseMapper().insert(category);
        result.put("success", count > 0);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/category/update")
    public ResponseEntity<Map<String, Object>> updateCategory(@RequestBody Category category) {
        Map<String, Object> result = new HashMap<>();
        int count = categoryService.getBaseMapper().updateById(category);
        result.put("success", count > 0);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/category/delete/{id}")
    public ResponseEntity<Map<String, Object>> deleteCategory(@PathVariable Long id) {
        Map<String, Object> result = new HashMap<>();
        int count = categoryService.getBaseMapper().deleteById(id);
        result.put("success", count > 0);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/orders")
    public ResponseEntity<IPage<Order>> getOrders(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Order::getStatus, status);
        }
        wrapper.orderByDesc(Order::getCreateTime);

        Page<Order> pageQuery = new Page<>(page, size);
        return ResponseEntity.ok(orderMapper.selectPage(pageQuery, wrapper));
    }

    @GetMapping("/order/detail/{id}")
    public ResponseEntity<Order> getOrderDetail(@PathVariable Long id) {
        return ResponseEntity.ok(orderMapper.selectById(id));
    }
}