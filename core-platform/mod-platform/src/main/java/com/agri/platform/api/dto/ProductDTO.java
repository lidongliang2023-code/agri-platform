package com.agri.platform.api.dto;

import java.math.BigDecimal;

/**
 * 商品 DTO（OHS 对外契约，统一商品中心）。
 */
public record ProductDTO(Long id, Long marketId, Long categoryId, Long merchantId, String code, String name,
                         String spec, String unit, BigDecimal price, BigDecimal stock, String traceCode,
                         Integer status) {
}
