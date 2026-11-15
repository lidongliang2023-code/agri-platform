package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.OrderItem;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.OrderItemMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;

/** 生产排产只读订单投影；仅卖方当前主体可见，不开放买方隐私或改写交期。 */
@RestController
@RequestMapping("/api/trade/processing-orders")
@RequiredArgsConstructor
public class ProcessingOrderController {
    private final TradeOrderMapper orders;
    private final OrderItemMapper items;
    private final PlatformIdentityService identity;
    @GetMapping
    public ApiResponse<?> list(@RequestParam Long merchantId) {
        var selection=identity.selectMerchant(merchantId);
        if(!selection.ok()) return ApiResponse.error(403,selection.error());
        return ApiResponse.success(orders.selectList(new LambdaQueryWrapper<TradeOrder>()
                .eq(TradeOrder::getSellerId,merchantId).orderByDesc(TradeOrder::getId).last("LIMIT 200")).stream().map(this::project).toList());
    }
    @GetMapping("/{id}")
    public ApiResponse<?> detail(@RequestParam Long merchantId,@PathVariable Long id) {
        var selection=identity.selectMerchant(merchantId);
        if(!selection.ok()) return ApiResponse.error(403,selection.error());
        TradeOrder order=orders.selectById(id);
        if(order==null || !merchantId.equals(order.getSellerId())) return ApiResponse.error(404,"当前主体无可排产订单");
        return ApiResponse.success(project(order));
    }
    private Map<String,Object> project(TradeOrder o) {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("id",String.valueOf(o.getId()));out.put("orderNo",o.getOrderNo());
        out.put("status",o.getOrderStatus());out.put("deliveryDeadline",o.getDeliveryDeadline()==null?null:o.getDeliveryDeadline().toInstant().atZone(java.time.ZoneId.of("Asia/Shanghai")).toLocalDateTime().toString());
        out.put("productName",o.getProductName());out.put("category",o.getCategoryName());
        List<Map<String,Object>> lines=new ArrayList<>();
        for(OrderItem i:items.selectList(new LambdaQueryWrapper<OrderItem>().eq(OrderItem::getOrderId,o.getId()))) {
            Map<String,Object> line=new LinkedHashMap<>();line.put("id",String.valueOf(i.getId()));
            line.put("productName",i.getProductName());line.put("category",i.getCategoryName());
            line.put("grade",i.getSpecLevel());line.put("quantity",i.getQuantity());line.put("unit",i.getUnit());
            lines.add(line);
        }
        out.put("items",lines); return out;
    }
}
