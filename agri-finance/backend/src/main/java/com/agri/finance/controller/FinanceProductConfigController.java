package com.agri.finance.controller;

import com.agri.finance.entity.FinanceProductConfig;
import com.agri.finance.mapper.FinanceProductConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/product-config")
public class FinanceProductConfigController {

    private final FinanceProductConfigMapper productConfigMapper;

    public FinanceProductConfigController(FinanceProductConfigMapper productConfigMapper) {
        this.productConfigMapper = productConfigMapper;
    }

    @GetMapping
    public Map<String, Object> list() {
        List<FinanceProductConfig> products = productConfigMapper.selectList(
                new LambdaQueryWrapper<FinanceProductConfig>()
                        .eq(FinanceProductConfig::getDelFlag, 0)
                        .orderByAsc(FinanceProductConfig::getProductCode)
        );
        return Map.of("code", 200, "message", "success", "data", products);
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable String id, @RequestBody FinanceProductConfig product) {
        FinanceProductConfig existing = productConfigMapper.selectById(id);
        if (existing == null) {
            return Map.of("code", 404, "message", "产品配置不存在", "data", "");
        }
        product.setId(id);
        product.setProductCode(existing.getProductCode());
        product.setProductName(existing.getProductName());
        product.setDelFlag(0);
        product.setUpdatedAt(LocalDateTime.now());
        productConfigMapper.updateById(product);
        return Map.of("code", 200, "message", "success", "data", productConfigMapper.selectById(id));
    }

    @PostMapping("/{id}/toggle")
    public Map<String, Object> toggle(@PathVariable String id) {
        FinanceProductConfig product = productConfigMapper.selectById(id);
        if (product == null) {
            return Map.of("code", 404, "message", "产品配置不存在", "data", "");
        }
        product.setStatus("启用".equals(product.getStatus()) ? "停用" : "启用");
        product.setUpdatedAt(LocalDateTime.now());
        productConfigMapper.updateById(product);
        return Map.of("code", 200, "message", "success", "data", product);
    }
}
