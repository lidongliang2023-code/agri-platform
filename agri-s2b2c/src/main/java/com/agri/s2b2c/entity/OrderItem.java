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
    private Integer quantity;
    private BigDecimal totalAmount;
    private String image;
    private String traceCode;
    private LocalDateTime createTime;
}