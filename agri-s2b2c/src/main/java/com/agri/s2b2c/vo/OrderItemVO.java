package com.agri.s2b2c.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class OrderItemVO {
    private Long id;
    private Long productId;
    private String name;
    private String spec;
    private BigDecimal price;
    private BigDecimal supplyPrice;
    private Integer quantity;
    private BigDecimal totalAmount;
    private String image;
    private String traceCode;
    /** 下单来源批次快照，不能替代实际出货单品绑定。 */
    private String prodBatchNo;
}