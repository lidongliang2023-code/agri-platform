package com.agri.trade.service;

import com.agri.trade.entity.Carrier;
import com.agri.trade.entity.Logistics;
import com.agri.trade.entity.LogisticsTrace;
import com.baomidou.mybatisplus.extension.service.IService;

import java.math.BigDecimal;
import java.util.List;

public interface ILogisticsService extends IService<Logistics> {

    Logistics createLogistics(Long orderId, Long carrierId);

    Logistics createLogisticsWithDetail(Long orderId, Long carrierId, String senderProvince, String senderCity, 
                                         String senderAddress, String receiverProvince, String receiverCity, 
                                         String receiverAddress, String goodsName, BigDecimal goodsWeight,
                                         BigDecimal freightAmount, String logisticsType, String tempRequire);

    boolean updateLogisticsStatus(Long logisticsId, String status, String location);

    boolean updateLocation(Long logisticsId, BigDecimal lat, BigDecimal lng, String location);

    boolean updateTemperature(Long logisticsId, BigDecimal temperature);

    LogisticsTrace addTrace(Long logisticsId, String status, String location, String description, 
                           BigDecimal lat, BigDecimal lng, BigDecimal temperature);

    List<LogisticsTrace> getTraceList(Long logisticsId);

    List<Carrier> searchCarriers(String province, String city, String logisticsType, String vehicleType);

    List<Carrier> getRecommendedCarriers(Long orderId);

    BigDecimal calculateFreight(Long carrierId, BigDecimal weight, BigDecimal volume, 
                                String fromProvince, String toProvince);

    boolean confirmDelivery(Long logisticsId, String signReceiver);

    boolean submitToChain(Long logisticsId);

    Logistics getByOrderId(Long orderId);

    List<Logistics> getByUserId(Long userId, String userType);

    List<Logistics> getAbnormalLogistics();
}