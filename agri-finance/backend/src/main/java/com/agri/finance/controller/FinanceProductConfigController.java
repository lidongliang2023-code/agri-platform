package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.FinanceProductConfig;
import com.agri.finance.mapper.FinanceProductConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/product-config")
@OperatorOnly("finance:fund")
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

    @PostMapping
    public Map<String, Object> create(@RequestBody FinanceProductConfig product) {
        String error = validate(product, null);
        if (error != null) {
            return Map.of("code", 400, "message", error, "data", "");
        }
        product.setId("PRODUCT-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase());
        product.setProductCode(product.getProductCode().trim().toLowerCase());
        product.setProductName(product.getProductName().trim());
        product.setDelFlag(0);
        product.setUpdatedAt(LocalDateTime.now());
        productConfigMapper.insert(product);
        return Map.of("code", 200, "message", "success", "data", productConfigMapper.selectById(product.getId()));
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable String id, @RequestBody FinanceProductConfig product) {
        FinanceProductConfig existing = productConfigMapper.selectById(id);
        if (existing == null) {
            return Map.of("code", 404, "message", "产品配置不存在", "data", "");
        }
        product.setProductCode(existing.getProductCode());
        String error = validate(product, id);
        if (error != null) {
            return Map.of("code", 400, "message", error, "data", "");
        }
        existing.setProductName(product.getProductName().trim());
        existing.setRate(product.getRate());
        existing.setTermMin(product.getTermMin());
        existing.setTermMax(product.getTermMax());
        existing.setAmountMin(product.getAmountMin());
        existing.setAmountMax(product.getAmountMax());
        existing.setPledgeRate(product.getPledgeRate());
        existing.setStatus(product.getStatus());
        existing.setDescription(product.getDescription());
        existing.setUpdatedAt(LocalDateTime.now());
        productConfigMapper.updateById(existing);
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

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable String id) {
        FinanceProductConfig product = productConfigMapper.selectById(id);
        if (product == null || Integer.valueOf(1).equals(product.getDelFlag())) {
            return Map.of("code", 404, "message", "产品配置不存在", "data", "");
        }
        // MyBatis-Plus 的逻辑删除字段不能通过普通 updateById 可靠写入，
        // 使用 deleteById 才会按全局配置生成 del_flag=1 的 UPDATE。
        productConfigMapper.deleteById(id);
        return Map.of("code", 200, "message", "success", "data", Map.of("id", id));
    }

    private String validate(FinanceProductConfig product, String excludeId) {
        if (product == null) return "产品配置不能为空";
        if (product.getProductCode() == null || product.getProductCode().isBlank()) return "请填写产品编码";
        if (!product.getProductCode().trim().matches("[a-zA-Z0-9_-]{2,64}")) return "产品编码只能包含字母、数字、横线和下划线";
        if (product.getProductName() == null || product.getProductName().isBlank()) return "请填写产品名称";
        if (product.getRate() == null || product.getRate().signum() < 0 || product.getRate().compareTo(java.math.BigDecimal.valueOf(100)) > 0) return "参考年化利率应在 0-100% 之间";
        if (product.getTermMin() == null || product.getTermMax() == null || product.getTermMin() <= 0 || product.getTermMax() < product.getTermMin()) return "融资期限配置不正确";
        if (product.getAmountMin() == null || product.getAmountMax() == null || product.getAmountMin().signum() <= 0 || product.getAmountMax().compareTo(product.getAmountMin()) < 0) return "融资金额范围配置不正确";
        if (product.getPledgeRate() == null || product.getPledgeRate().signum() < 0 || product.getPledgeRate().compareTo(java.math.BigDecimal.valueOf(100)) > 0) return "质押率应在 0-100% 之间";
        if (!List.of("启用", "停用").contains(product.getStatus())) return "产品状态不正确";
        LambdaQueryWrapper<FinanceProductConfig> duplicate = new LambdaQueryWrapper<FinanceProductConfig>()
                .eq(FinanceProductConfig::getProductCode, product.getProductCode().trim().toLowerCase())
                .eq(FinanceProductConfig::getDelFlag, 0);
        if (excludeId != null) duplicate.ne(FinanceProductConfig::getId, excludeId);
        if (productConfigMapper.selectCount(duplicate) > 0) return "产品编码已存在";
        return null;
    }
}
