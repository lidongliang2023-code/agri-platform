package com.agri.iot.entity.trade;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_logistics")
public class Logistics {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("logistics_no")
    private String logisticsNo;

    @TableField("order_id")
    private Long orderId;

    @TableField("order_no")
    private String orderNo;

    @TableField("carrier_id")
    private Long carrierId;

    @TableField("carrier_name")
    private String carrierName;

    @TableField("carrier_no")
    private String carrierNo;

    @TableField("logistics_type")
    private String logisticsType;

    @TableField("temp_require")
    private String tempRequire;

    @TableField("vehicle_type")
    private String vehicleType;

    @TableField("sender_province")
    private String senderProvince;

    @TableField("sender_city")
    private String senderCity;

    @TableField("sender_district")
    private String senderDistrict;

    @TableField("sender_address")
    private String senderAddress;

    @TableField("sender_contact")
    private String senderContact;

    @TableField("sender_phone")
    private String senderPhone;

    @TableField("receiver_province")
    private String receiverProvince;

    @TableField("receiver_city")
    private String receiverCity;

    @TableField("receiver_district")
    private String receiverDistrict;

    @TableField("receiver_address")
    private String receiverAddress;

    @TableField("receiver_contact")
    private String receiverContact;

    @TableField("receiver_phone")
    private String receiverPhone;

    @TableField("goods_name")
    private String goodsName;

    @TableField("goods_weight")
    private BigDecimal goodsWeight;

    @TableField("goods_volume")
    private BigDecimal goodsVolume;

    @TableField("goods_count")
    private Integer goodsCount;

    @TableField("freight_amount")
    private BigDecimal freightAmount;

    @TableField("pay_method")
    private String payMethod;

    @TableField("expect_delivery_time")
    private Date expectDeliveryTime;

    @TableField("pickup_time")
    private Date pickupTime;

    @TableField("delivery_time")
    private Date deliveryTime;

    @TableField("estimate_time")
    private Date estimateTime;

    @TableField("actual_arrival_time")
    private Date actualArrivalTime;

    @TableField("sign_time")
    private Date signTime;

    @TableField("sign_receiver")
    private String signReceiver;

    @TableField("logistics_status")
    private String logisticsStatus;

    @TableField("current_location")
    private String currentLocation;

    @TableField("current_lat")
    private BigDecimal currentLat;

    @TableField("current_lng")
    private BigDecimal currentLng;

    @TableField("temperature")
    private BigDecimal temperature;

    @TableField("is_cod")
    private Integer isCod;

    @TableField("cod_amount")
    private BigDecimal codAmount;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;

    @TableField("update_by")
    private String updateBy;

    @TableField("update_time")
    private Date updateTime;
}