package com.agri.trade.mapper;

import com.agri.trade.entity.ProductImage;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 商品图片 Mapper。
 *
 * <p>实体（ProductImage）一直在，Mapper 却一直没有 —— 于是 agri_trade_product_image
 * 表有数据、有实体，却没有任何读写入口，商品详情页只能挂占位图。</p>
 */
@Mapper
public interface ProductImageMapper extends BaseMapper<ProductImage> {
}
