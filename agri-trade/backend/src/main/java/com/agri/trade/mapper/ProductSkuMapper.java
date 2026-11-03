package com.agri.trade.mapper;

import com.agri.trade.entity.ProductSku;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** 商品 SKU 持久化。 */
@Mapper
public interface ProductSkuMapper extends BaseMapper<ProductSku> {
}
