package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("s2b2c_order_item")
public class OrderItem {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long orderId;
    private Long productId;
    private Long skuId;
    private String name;
    private String spec;
    private BigDecimal price;
    /** 下单时的供货价快照，用于供应商收入/对账，不受后续调价影响。 */
    private BigDecimal supplyPrice;
    private Integer quantity;
    private BigDecimal totalAmount;
    private String image;
    private String traceCode;
    /** 秒杀活动ID；取消订单时据此精确恢复秒杀库存与预算。 */
    private Long flashSaleId;
    private BigDecimal flashSubsidy;
    private LocalDateTime createTime;
}