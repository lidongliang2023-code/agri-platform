package com.agri.s2b2c.controller;

import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.entity.Supplier;
import com.agri.s2b2c.service.ProductService;
import com.agri.s2b2c.service.SupplierService;
import com.agri.s2b2c.vo.ProductVO;
import com.agri.s2b2c.vo.SupplierVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/supplier")
public class SupplierController {

    private final SupplierService supplierService;
    private final ProductService productService;

    public SupplierController(SupplierService supplierService, ProductService productService) {
        this.supplierService = supplierService;
        this.productService = productService;
    }

    @PostMapping("/apply")
    public ResponseEntity<Map<String, Object>> apply(@RequestBody Supplier supplier) {
        Map<String, Object> result = new HashMap<>();
        boolean success = supplierService.apply(supplier);
        result.put("success", success);
        result.put("message", success ? "申请提交成功，等待审核" : "申请提交失败");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/detail/{id}")
    public ResponseEntity<SupplierVO> getDetail(@PathVariable Long id) {
        return ResponseEntity.ok(supplierService.getById(id));
    }

    @GetMapping("/products")
    public ResponseEntity<IPage<ProductVO>> getProducts(
            @RequestParam Long supplierId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(supplierService.getProducts(supplierId, page, size, status));
    }

    @PostMapping("/product/create")
    public ResponseEntity<Map<String, Object>> createProduct(@RequestBody Product product) {
        Map<String, Object> result = new HashMap<>();
        boolean success = productService.create(product);
        result.put("success", success);
        result.put("message", success ? "商品创建成功，等待审核" : "商品创建失败");
        return ResponseEntity.ok(result);
    }

    @PutMapping("/product/update")
    public ResponseEntity<Map<String, Object>> updateProduct(@RequestBody Product product) {
        Map<String, Object> result = new HashMap<>();
        boolean success = productService.update(product);
        result.put("success", success);
        result.put("message", success ? "商品更新成功" : "商品更新失败");
        return ResponseEntity.ok(result);
    }

    @PutMapping("/update")
    public ResponseEntity<Map<String, Object>> updateInfo(@RequestBody Supplier supplier) {
        Map<String, Object> result = new HashMap<>();
        boolean success = supplierService.updateInfo(supplier);
        result.put("success", success);
        result.put("message", success ? "信息更新成功" : "信息更新失败");
        return ResponseEntity.ok(result);
    }
}