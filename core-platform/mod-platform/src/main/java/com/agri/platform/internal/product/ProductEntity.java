package com.agri.platform.internal.product;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/**
 * 统一商品（平台域主数据，market_id 内建）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_product")
public class ProductEntity extends BaseEntity {

    private Long categoryId;
    private Long merchantId;
    private String code;
    private String name;
    private String spec;
    private String unit;

    private BigDecimal price;
    private BigDecimal stock;

    /** 溯源码（生产域 batch.harvested 事件后由交易域经 ProductFacade 挂载） */
    private String traceCode;

    /** 1=在售 0=下架 */
    private Integer status;
}
