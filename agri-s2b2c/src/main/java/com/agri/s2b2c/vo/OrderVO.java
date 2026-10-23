package com.agri.s2b2c.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class OrderVO {
    private Long id;
    private String orderNo;
    private String status;
    private String statusText;
    private BigDecimal totalAmount;
    private BigDecimal discountAmount;
    private BigDecimal payAmount;
    private String payMethod;
    private LocalDateTime payTime;
    private String deliveryType;
    private String logisticsNo;
    private String logisticsCompany;
    private String remark;
    private List<OrderItemVO> items;
    private AddressVO address;
    private LocalDateTime createTime;
}