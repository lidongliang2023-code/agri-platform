package com.agri.s2b2c.controller;

import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.service.ChannelPartnerService;
import com.agri.s2b2c.service.ProductService;
import com.agri.s2b2c.vo.ChannelPartnerVO;
import com.agri.s2b2c.vo.CommissionVO;
import com.agri.s2b2c.vo.ProductVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/channel")
public class ChannelPartnerController {

    private final ChannelPartnerService channelPartnerService;
    private final ProductService productService;

    public ChannelPartnerController(ChannelPartnerService channelPartnerService, ProductService productService) {
        this.channelPartnerService = channelPartnerService;
        this.productService = productService;
    }

    @PostMapping("/apply")
    public ResponseEntity<Map<String, Object>> apply(@RequestBody ChannelPartner partner) {
        Map<String, Object> result = new HashMap<>();
        boolean success = channelPartnerService.apply(partner);
        result.put("success", success);
        result.put("message", success ? "申请提交成功，等待审核" : "申请提交失败");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/detail/{id}")
    public ResponseEntity<ChannelPartnerVO> getDetail(@PathVariable Long id) {
        return ResponseEntity.ok(channelPartnerService.getById(id));
    }

    @GetMapping("/products")
    public ResponseEntity<IPage<ProductVO>> getProducts(
            @RequestParam Long channelId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(channelPartnerService.getSelectedProducts(channelId, page, size));
    }

    @GetMapping("/product-pool")
    public ResponseEntity<IPage<ProductVO>> getProductPool(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId) {
        return ResponseEntity.ok(productService.pageList(page, size, keyword, categoryId, null, "APPROVED"));
    }

    @PostMapping("/select-product")
    public ResponseEntity<Map<String, Object>> selectProduct(
            @RequestParam Long channelId,
            @RequestParam Long productId) {
        Map<String, Object> result = new HashMap<>();
        boolean success = channelPartnerService.selectProduct(channelId, productId);
        result.put("success", success);
        result.put("message", success ? "选品成功" : "选品失败");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/commissions")
    public ResponseEntity<IPage<CommissionVO>> getCommissions(
            @RequestParam Long channelId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(channelPartnerService.getCommissions(channelId, page, size, status));
    }

    @GetMapping("/total-commission")
    public ResponseEntity<Map<String, Object>> getTotalCommission(@RequestParam Long channelId) {
        Map<String, Object> result = new HashMap<>();
        BigDecimal total = channelPartnerService.getTotalCommission(channelId);
        result.put("total", total);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/update")
    public ResponseEntity<Map<String, Object>> updateInfo(@RequestBody ChannelPartner partner) {
        Map<String, Object> result = new HashMap<>();
        boolean success = channelPartnerService.updateInfo(partner);
        result.put("success", success);
        result.put("message", success ? "信息更新成功" : "信息更新失败");
        return ResponseEntity.ok(result);
    }
}