package com.agri.s2b2c.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class OrderVO {
    private Long id;
    private String orderNo;
    private Long consumerId;
    private Long shopId;
    private Long supplierId;
    private Long channelId;
    private Long addressId;
    private String status;
    private String statusText;
    private BigDecimal totalAmount;
    private BigDecimal discountAmount;
    private BigDecimal freightAmount;
    private BigDecimal payAmount;
    private Long couponUserId;
    private BigDecimal couponDiscount;
    private String payMethod;
    private LocalDateTime payTime;
    private String deliveryType;
    private String deliveryTime;
    private String logisticsNo;
    private String logisticsCompany;
    private String remark;
    /** 拼团订单才有值：活动ID与团实例ID，前端据此显示「拼团」标并可跳回活动。 */
    private Long groupBuyId;
    private Long groupInstanceId;
    private List<OrderItemVO> items;
    private AddressVO address;
    private LocalDateTime createTime;
}
