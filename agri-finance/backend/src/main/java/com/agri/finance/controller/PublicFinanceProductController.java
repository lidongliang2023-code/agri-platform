package com.agri.finance.controller;

import com.agri.finance.entity.FinanceProductConfig;
import com.agri.finance.mapper.FinanceProductConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 对官网门户和融资方产品中心公开的启用产品目录。
 *
 * <p>数据源与资金方端产品配置完全一致。该路径刻意放在 /open 下，避免被运营端
 * RBAC 的 /api/** 准入策略拦截，同时只返回启用且未删除的产品。</p>
 */
@RestController
@RequestMapping("/open/finance/products")
public class PublicFinanceProductController {

    private final FinanceProductConfigMapper productConfigMapper;

    public PublicFinanceProductController(FinanceProductConfigMapper productConfigMapper) {
        this.productConfigMapper = productConfigMapper;
    }

    @GetMapping
    public Map<String, Object> activeProducts() {
        List<FinanceProductConfig> products = productConfigMapper.selectList(
                new LambdaQueryWrapper<FinanceProductConfig>()
                        .eq(FinanceProductConfig::getDelFlag, 0)
                        .eq(FinanceProductConfig::getStatus, "启用")
                        .orderByAsc(FinanceProductConfig::getAmountMin)
                        .orderByAsc(FinanceProductConfig::getProductCode)
        );
        return Map.of("code", 200, "message", "success", "data", products);
    }
}
