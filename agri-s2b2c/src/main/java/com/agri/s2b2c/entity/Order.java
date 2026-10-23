package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("s2b2c_order")
public class Order {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private String orderNo;
    private Long consumerId;
    private Long shopId;
    private Long supplierId;
    private Long channelId;
    private Long addressId;
    private String status;
    private BigDecimal totalAmount;
    private BigDecimal discountAmount;
    private BigDecimal freightAmount;
    private BigDecimal payAmount;
    private String payMethod;
    private LocalDateTime payTime;
    private String deliveryType;
    private String deliveryTime;
    private String logisticsNo;
    private String logisticsCompany;
    private String remark;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}