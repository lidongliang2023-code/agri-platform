package com.agri.trade.service.impl;

import com.agri.trade.entity.Carrier;
import com.agri.trade.entity.Logistics;
import com.agri.trade.entity.LogisticsTrace;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.CarrierMapper;
import com.agri.trade.mapper.LogisticsMapper;
import com.agri.trade.mapper.LogisticsTraceMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.service.ILogisticsService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Date;
import java.util.List;
import java.util.Random;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class LogisticsServiceImpl extends ServiceImpl<LogisticsMapper, Logistics> implements ILogisticsService {

    private final LogisticsTraceMapper traceMapper;
    private final CarrierMapper carrierMapper;
    private final TradeOrderMapper orderMapper;
    private final Random random = new Random();

    @Override
    @Transactional
    public Logistics createLogistics(Long orderId, Long carrierId) {
        TradeOrder order = orderMapper.selectById(orderId);
        if (order == null) {
            return null;
        }

        Carrier carrier = carrierMapper.selectById(carrierId);
        if (carrier == null) {
            return null;
        }

        Logistics logistics = new Logistics();
        logistics.setLogisticsNo("LG" + System.currentTimeMillis());
        logistics.setOrderId(orderId);
        logistics.setOrderNo(order.getOrderNo());
        logistics.setCarrierId(carrierId);
        logistics.setCarrierName(carrier.getCarrierName());
        logistics.setCarrierNo(carrier.getCarrierCode());
        logistics.setSenderProvince(order.getSellerProvince());
        logistics.setSenderCity(order.getSellerCity());
        logistics.setSenderAddress(order.getSellerAddress());
        logistics.setReceiverProvince(order.getBuyerProvince());
        logistics.setReceiverCity(order.getBuyerCity());
        logistics.setReceiverAddress(order.getDeliveryAddress());
        logistics.setReceiverContact(order.getBuyerName());
        logistics.setReceiverPhone(order.getBuyerPhone());
        logistics.setGoodsName(order.getProductName());
        logistics.setGoodsWeight(order.getTotalQuantity());
        logistics.setLogisticsType("normal");
        logistics.setLogisticsStatus("pending");
        logistics.setDelFlag(0);
        logistics.setCreateTime(new Date());
        logistics.setUpdateTime(new Date());

        baseMapper.insert(logistics);

        addTrace(logistics.getId(), "created", logistics.getSenderAddress(), 
                 "物流单已创建，等待揽收", null, null, null);

        return logistics;
    }

    @Override
    @Transactional
    public Logistics createLogisticsWithDetail(Long orderId, Long carrierId, String senderProvince, String senderCity,
                                               String senderAddress, String receiverProvince, String receiverCity,
                                               String receiverAddress, String goodsName, BigDecimal goodsWeight,
                                               BigDecimal freightAmount, String logisticsType, String tempRequire) {
        Carrier carrier = carrierMapper.selectById(carrierId);

        Logistics logistics = new Logistics();
        logistics.setLogisticsNo("LG" + System.currentTimeMillis());
        logistics.setOrderId(orderId);
        logistics.setCarrierId(carrierId);
        logistics.setCarrierName(carrier != null ? carrier.getCarrierName() : "");
        logistics.setCarrierNo(carrier != null ? carrier.getCarrierCode() : "");
        logistics.setSenderProvince(senderProvince);
        logistics.setSenderCity(senderCity);
        logistics.setSenderAddress(senderAddress);
        logistics.setReceiverProvince(receiverProvince);
        logistics.setReceiverCity(receiverCity);
        logistics.setReceiverAddress(receiverAddress);
        logistics.setGoodsName(goodsName);
        logistics.setGoodsWeight(goodsWeight);
        logistics.setFreightAmount(freightAmount);
        logistics.setLogisticsType(logisticsType);
        logistics.setTempRequire(tempRequire);
        logistics.setLogisticsStatus("pending");
        logistics.setDelFlag(0);
        logistics.setCreateTime(new Date());
        logistics.setUpdateTime(new Date());

        baseMapper.insert(logistics);

        addTrace(logistics.getId(), "created", senderAddress, "物流单已创建", null, null, null);

        return logistics;
    }

    @Override
    @Transactional
    public boolean updateLogisticsStatus(Long logisticsId, String status, String location) {
        Logistics logistics = baseMapper.selectById(logisticsId);
        if (logistics == null) {
            return false;
        }

        logistics.setLogisticsStatus(status);
        logistics.setCurrentLocation(location);
        logistics.setUpdateTime(new Date());
        baseMapper.updateById(logistics);

        String description = getStatusDescription(status);
        addTrace(logisticsId, status, location, description, null, null, null);

        return true;
    }

    @Override
    @Transactional
    public boolean updateLocation(Long logisticsId, BigDecimal lat, BigDecimal lng, String location) {
        Logistics logistics = baseMapper.selectById(logisticsId);
        if (logistics == null) {
            return false;
        }

        logistics.setCurrentLat(lat);
        logistics.setCurrentLng(lng);
        logistics.setCurrentLocation(location);
        logistics.setUpdateTime(new Date());
        baseMapper.updateById(logistics);

        return true;
    }

    @Override
    @Transactional
    public boolean updateTemperature(Long logisticsId, BigDecimal temperature) {
        Logistics logistics = baseMapper.selectById(logisticsId);
        if (logistics == null) {
            return false;
        }

        logistics.setTemperature(temperature);
        logistics.setUpdateTime(new Date());
        baseMapper.updateById(logistics);

        addTrace(logisticsId, "temperature_update", logistics.getCurrentLocation(), 
                 "温度更新: " + temperature + "°C", null, null, temperature);

        return true;
    }

    @Override
    @Transactional
    public LogisticsTrace addTrace(Long logisticsId, String status, String location, String description,
                                   BigDecimal lat, BigDecimal lng, BigDecimal temperature) {
        Logistics logistics = baseMapper.selectById(logisticsId);

        LogisticsTrace trace = new LogisticsTrace();
        trace.setLogisticsId(logisticsId);
        trace.setLogisticsNo(logistics != null ? logistics.getLogisticsNo() : "");
        trace.setTraceNo("TC" + System.currentTimeMillis());
        trace.setTraceTime(new Date());
        trace.setTraceStatus(status);
        trace.setTraceLocation(location);
        trace.setTraceLat(lat);
        trace.setTraceLng(lng);
        trace.setTraceDescription(description);
        trace.setTemperature(temperature);
        trace.setIsSignificant("picked".equals(status) || "in_transit".equals(status) || 
                              "arrived".equals(status) || "delivered".equals(status) ? 1 : 0);
        trace.setChainStatus("pending");
        trace.setDelFlag(0);
        trace.setCreateTime(new Date());

        traceMapper.insert(trace);

        return trace;
    }

    @Override
    public List<LogisticsTrace> getTraceList(Long logisticsId) {
        LambdaQueryWrapper<LogisticsTrace> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(LogisticsTrace::getLogisticsId, logisticsId);
        wrapper.eq(LogisticsTrace::getDelFlag, 0);
        wrapper.orderByAsc(LogisticsTrace::getTraceTime);
        return traceMapper.selectList(wrapper);
    }

    @Override
    public List<Carrier> searchCarriers(String province, String city, String logisticsType, String vehicleType) {
        LambdaQueryWrapper<Carrier> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Carrier::getStatus, 1);
        wrapper.eq(Carrier::getDelFlag, 0);
        
        if (province != null && !province.isEmpty()) {
            wrapper.eq(Carrier::getProvince, province);
        }
        if (city != null && !city.isEmpty()) {
            wrapper.like(Carrier::getCoverageCities, city);
        }
        if (logisticsType != null && !logisticsType.isEmpty()) {
            wrapper.like(Carrier::getServiceScope, logisticsType);
        }

        return carrierMapper.selectList(wrapper);
    }

    @Override
    public List<Carrier> getRecommendedCarriers(Long orderId) {
        TradeOrder order = orderMapper.selectById(orderId);
        if (order == null) {
            return searchCarriers(null, null, null, null);
        }

        return searchCarriers(order.getSellerProvince(), order.getBuyerCity(), null, null);
    }

    @Override
    public BigDecimal calculateFreight(Long carrierId, BigDecimal weight, BigDecimal volume,
                                       String fromProvince, String toProvince) {
        Carrier carrier = carrierMapper.selectById(carrierId);
        if (carrier == null) {
            return BigDecimal.ZERO;
        }

        BigDecimal baseRate = new BigDecimal("2.5");
        BigDecimal distanceFactor = calculateDistanceFactor(fromProvince, toProvince);
        
        BigDecimal weightCost = weight.multiply(baseRate).multiply(distanceFactor);
        BigDecimal volumeCost = volume.multiply(new BigDecimal("1.5")).multiply(distanceFactor);
        
        BigDecimal total = weightCost.add(volumeCost).setScale(2, RoundingMode.HALF_UP);
        
        return total;
    }

    @Override
    @Transactional
    public boolean confirmDelivery(Long logisticsId, String signReceiver) {
        Logistics logistics = baseMapper.selectById(logisticsId);
        if (logistics == null) {
            return false;
        }

        logistics.setLogisticsStatus("delivered");
        logistics.setSignTime(new Date());
        logistics.setSignReceiver(signReceiver);
        logistics.setActualArrivalTime(new Date());
        logistics.setUpdateTime(new Date());
        baseMapper.updateById(logistics);

        addTrace(logisticsId, "delivered", logistics.getReceiverAddress(), 
                 "已签收，签收人: " + signReceiver, null, null, null);

        return true;
    }

    @Override
    @Transactional
    public boolean submitToChain(Long logisticsId) {
        Logistics logistics = baseMapper.selectById(logisticsId);
        if (logistics == null) {
            return false;
        }

        String txHash = UUID.randomUUID().toString();
        logistics.setLogisticsStatus("chain_recorded");
        logistics.setUpdateTime(new Date());
        baseMapper.updateById(logistics);

        LambdaQueryWrapper<LogisticsTrace> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(LogisticsTrace::getLogisticsId, logisticsId);
        wrapper.eq(LogisticsTrace::getDelFlag, 0);
        List<LogisticsTrace> traces = traceMapper.selectList(wrapper);

        for (LogisticsTrace trace : traces) {
            trace.setChainStatus("success");
            trace.setChainTxHash(txHash);
            traceMapper.updateById(trace);
        }

        return true;
    }

    @Override
    public Logistics getByOrderId(Long orderId) {
        LambdaQueryWrapper<Logistics> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Logistics::getOrderId, orderId);
        wrapper.eq(Logistics::getDelFlag, 0);
        return baseMapper.selectOne(wrapper);
    }

    @Override
    public List<Logistics> getByUserId(Long userId, String userType) {
        LambdaQueryWrapper<Logistics> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Logistics::getDelFlag, 0);
        wrapper.orderByDesc(Logistics::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<Logistics> getAbnormalLogistics() {
        LambdaQueryWrapper<Logistics> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Logistics::getDelFlag, 0);
        wrapper.notIn(Logistics::getLogisticsStatus, "delivered", "cancelled");
        
        return baseMapper.selectList(wrapper);
    }

    private String getStatusDescription(String status) {
        return switch (status) {
            case "pending" -> "待揽收";
            case "picked" -> "已揽收，正在分拣";
            case "in_transit" -> "运输中";
            case "arrived" -> "已到达目的地";
            case "delivered" -> "已签收";
            case "exception" -> "运输异常";
            default -> status;
        };
    }

    private BigDecimal calculateDistanceFactor(String fromProvince, String toProvince) {
        if (fromProvince == null || toProvince == null) {
            return new BigDecimal("1.0");
        }
        
        if (fromProvince.equals(toProvince)) {
            return new BigDecimal("0.8");
        }
        
        return new BigDecimal("1.0").add(BigDecimal.valueOf(random.nextDouble() * 0.5));
    }
}