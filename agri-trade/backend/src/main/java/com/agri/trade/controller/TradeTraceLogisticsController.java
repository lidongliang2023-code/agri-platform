package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Logistics;
import com.agri.trade.entity.LogisticsTrace;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.LogisticsMapper;
import com.agri.trade.mapper.LogisticsTraceMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 产销溯源支持：大宗交易物流与履约轨迹查询。
 *
 * <p>必须受经营主体控制，不可全量公开：
 * 1. 调取者必须是该笔大宗订单的买卖双方主体之一（防止跨主体枚举大宗流向）。
 * 2. 字段只公开承运商、大宗运输状态、发生时间、轨迹节点，不回传买卖双方真实电话与地址隐私。</p>
 */
@RestController
@RequestMapping("/api/trade/logistics/trace-chain")
@RequiredArgsConstructor
public class TradeTraceLogisticsController {

    private final TradeOrderMapper orderMapper;
    private final LogisticsMapper logisticsMapper;
    private final LogisticsTraceMapper traceMapper;
    private final PlatformIdentityService identityService;

    /** 原始自由文本可能包含联系人、地址或金额，本查询仅输出隐私提示。 */
    static String redact(String text, boolean location) {
        if (text == null || text.isBlank()) return null;
        return location ? "位置详情已脱敏" : "轨迹详情已脱敏，请查看节点状态与时间";
    }

    @GetMapping("/by-offer")
    public ApiResponse<List<Map<String, Object>>> getLogisticsByOffer(@RequestParam String offerNo, @RequestParam Long subjectId) {
        if (offerNo == null || offerNo.isBlank()) {
            return ApiResponse.error(400, "供给单号不能为空");
        }
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(401, scope.error() == null ? "登录凭证已失效或无法解析主体" : scope.error());
        }
        if (subjectId == null || !scope.merchantIds().contains(subjectId)) {
            return ApiResponse.error(403, "无权查询该经营主体的大宗履约");
        }

        LambdaQueryWrapper<TradeOrder> orderQuery = new LambdaQueryWrapper<>();
        orderQuery.eq(TradeOrder::getSourceOfferNo, offerNo.trim())
                .eq(TradeOrder::getDelFlag, 0)
                .and(w -> w.eq(TradeOrder::getSellerId, subjectId)
                        .or().eq(TradeOrder::getBuyerId, subjectId))
                .orderByDesc(TradeOrder::getId);
        List<TradeOrder> orders = orderMapper.selectList(orderQuery);
        if (orders.isEmpty()) {
            return ApiResponse.success(List.of());
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (TradeOrder order : orders) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("orderNo", order.getOrderNo());
            item.put("productName", order.getProductName());
            item.put("quantity", order.getTotalQuantity());
            item.put("orderStatus", order.getOrderStatus());
            item.put("sourceOfferNo", order.getSourceOfferNo());
            item.put("createTime", order.getCreateTime());

            List<Logistics> shipments = logisticsMapper.selectList(new LambdaQueryWrapper<Logistics>()
                    .eq(Logistics::getOrderId, order.getId()).eq(Logistics::getDelFlag, 0)
                    .orderByAsc(Logistics::getId));
            List<Map<String, Object>> shipmentRows = new ArrayList<>();
            for (Logistics logistics : shipments) {
                Map<String, Object> shipment = new LinkedHashMap<>();
                shipment.put("hasLogistics", true);
                shipment.put("logisticsNo", logistics.getLogisticsNo());
                shipment.put("carrierName", logistics.getCarrierName());
                shipment.put("logisticsStatus", logistics.getLogisticsStatus());
                shipment.put("currentLocation", redact(logistics.getCurrentLocation(), true));
                shipment.put("temperature", logistics.getTemperature());
                shipment.put("pickupTime", logistics.getPickupTime());
                shipment.put("deliveryTime", logistics.getDeliveryTime());
                shipment.put("actualArrivalTime", logistics.getActualArrivalTime());

                List<LogisticsTrace> traces = traceMapper.selectList(new LambdaQueryWrapper<LogisticsTrace>()
                        .eq(LogisticsTrace::getLogisticsId, logistics.getId())
                        .eq(LogisticsTrace::getDelFlag, 0)
                        .orderByAsc(LogisticsTrace::getTraceTime));
                List<Map<String, Object>> traceRows = new ArrayList<>();
                for (LogisticsTrace trace : traces) {
                    Map<String, Object> t = new LinkedHashMap<>();
                    t.put("traceStatus", trace.getTraceStatus());
                    t.put("traceLocation", redact(trace.getTraceLocation(), true));
                    t.put("traceDescription", redact(trace.getTraceDescription(), false));
                    t.put("traceTime", trace.getTraceTime());
                    t.put("temperature", trace.getTemperature());
                    traceRows.add(t);
                }
                shipment.put("traces", traceRows);
                shipmentRows.add(shipment);
            }
            item.put("shipments", shipmentRows);
            item.put("hasLogistics", !shipmentRows.isEmpty());
            result.add(item);
        }
        return ApiResponse.success(result);
    }
}
