package com.agri.platform.api.facade;

import com.agri.platform.api.dto.ProductDTO;

import java.math.BigDecimal;

/**
 * 商品中心 OHS 门面（ADR-004：引擎只消费、不私建商品表）。
 */
public interface ProductFacade {

    ProductDTO getProduct(Long productId);

    /** 扣减库存（乐观条件更新，不足时返回 false） */
    boolean decreaseStock(Long productId, BigDecimal quantity);

    /** 采收批次溯源码挂载到商品（交易域在消费 batch.harvested 事件后调用） */
    void attachTraceCode(Long productId, String traceCode);
}
