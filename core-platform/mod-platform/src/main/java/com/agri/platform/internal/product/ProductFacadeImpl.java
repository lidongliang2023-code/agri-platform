package com.agri.platform.internal.product;

import com.agri.platform.api.dto.ProductDTO;
import com.agri.platform.api.facade.ProductFacade;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * 商品中心 OHS 门面实现。库存扣减用条件更新保证不超卖；溯源码挂载供交易域事件消费调用。
 */
@Service
@RequiredArgsConstructor
public class ProductFacadeImpl implements ProductFacade {

    private final ProductMapper productMapper;

    @Override
    public ProductDTO getProduct(Long productId) {
        ProductEntity product = productMapper.selectById(productId);
        return product == null ? null : new ProductDTO(product.getId(), product.getMarketId(),
                product.getCategoryId(), product.getMerchantId(), product.getCode(), product.getName(),
                product.getSpec(), product.getUnit(), product.getPrice(), product.getStock(),
                product.getTraceCode(), product.getStatus());
    }

    @Override
    public boolean decreaseStock(Long productId, BigDecimal quantity) {
        return productMapper.update(null, new LambdaUpdateWrapper<ProductEntity>()
                .eq(ProductEntity::getId, productId)
                .ge(ProductEntity::getStock, quantity)
                .setSql("stock = stock - " + quantity.toPlainString())) > 0;
    }

    @Override
    public void attachTraceCode(Long productId, String traceCode) {
        productMapper.update(null, new LambdaUpdateWrapper<ProductEntity>()
                .eq(ProductEntity::getId, productId)
                .set(ProductEntity::getTraceCode, traceCode));
    }
}
