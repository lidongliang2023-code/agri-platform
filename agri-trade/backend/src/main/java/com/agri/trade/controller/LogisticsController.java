package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Logistics;
import com.agri.trade.entity.LogisticsTrace;
import com.agri.trade.entity.Carrier;
import com.agri.trade.mapper.LogisticsMapper;
import com.agri.trade.mapper.LogisticsTraceMapper;
import com.agri.trade.mapper.CarrierMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/api/trade/logistics")
@RequiredArgsConstructor
public class LogisticsController {

    private final LogisticsMapper logisticsMapper;
    private final LogisticsTraceMapper traceMapper;
    private final CarrierMapper carrierMapper;

    @GetMapping("/carrier/page")
    public ApiResponse<IPage<Carrier>> getCarrierPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        Page<Carrier> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Carrier> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Carrier::getDelFlag, 0);
        wrapper.eq(Carrier::getStatus, 1);
        wrapper.orderByDesc(Carrier::getRating);
        return ApiResponse.success(carrierMapper.selectPage(page, wrapper));
    }

    @GetMapping("/carrier/list")
    public ApiResponse<List<Carrier>> getCarrierList() {
        LambdaQueryWrapper<Carrier> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Carrier::getDelFlag, 0);
        wrapper.eq(Carrier::getStatus, 1);
        return ApiResponse.success(carrierMapper.selectList(wrapper));
    }

    @PostMapping("/carrier")
    public ApiResponse<Boolean> createCarrier(@RequestBody Carrier carrier) {
        carrier.setCarrierCode("CR" + System.currentTimeMillis());
        carrier.setDelFlag(0);
        carrier.setStatus(1);
        carrier.setCreateTime(new Date());
        carrier.setUpdateTime(new Date());
        int result = carrierMapper.insert(carrier);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @GetMapping("/page")
    public ApiResponse<IPage<Logistics>> getLogisticsPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) String logisticsStatus,
            // 列表页的搜索框一直在，但后端从来没收过 logisticsNo —— 输了字点搜索没有任何变化。
            @RequestParam(required = false) String logisticsNo) {
        Page<Logistics> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Logistics> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Logistics::getDelFlag, 0);
        if (orderId != null) wrapper.eq(Logistics::getOrderId, orderId);
        if (logisticsStatus != null) wrapper.eq(Logistics::getLogisticsStatus, logisticsStatus);
        if (logisticsNo != null && !logisticsNo.isEmpty()) wrapper.like(Logistics::getLogisticsNo, logisticsNo);
        wrapper.orderByDesc(Logistics::getCreateTime);
        return ApiResponse.success(logisticsMapper.selectPage(page, wrapper));
    }

    /** 删除物流单（软删）。已签收的单子不允许删 —— 那是运输凭证。 */
    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> deleteLogistics(@PathVariable Long id) {
        Logistics logistics = logisticsMapper.selectById(id);
        if (logistics == null) return ApiResponse.error("物流订单不存在");
        if ("delivered".equals(logistics.getLogisticsStatus())) {
            return ApiResponse.error("已签收的物流单不能删除");
        }
        // 与其它模块同样的坑：全局逻辑删除字段不会被 updateById 写进 SET，必须用 deleteById
        int result = logisticsMapper.deleteById(id);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("删除失败");
    }

    @GetMapping("/{id}")
    public ApiResponse<Logistics> getLogisticsById(@PathVariable Long id) {
        Logistics logistics = logisticsMapper.selectById(id);
        if (logistics == null) return ApiResponse.error("物流订单不存在");
        return ApiResponse.success(logistics);
    }

    @GetMapping("/{id}/traces")
    public ApiResponse<List<LogisticsTrace>> getLogisticsTraces(@PathVariable Long id) {
        LambdaQueryWrapper<LogisticsTrace> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(LogisticsTrace::getLogisticsId, id);
        wrapper.eq(LogisticsTrace::getDelFlag, 0);
        wrapper.orderByAsc(LogisticsTrace::getTraceTime);
        return ApiResponse.success(traceMapper.selectList(wrapper));
    }

    @PostMapping
    public ApiResponse<Boolean> createLogistics(@RequestBody Logistics logistics) {
        logistics.setLogisticsNo("LG" + System.currentTimeMillis());
        logistics.setDelFlag(0);
        logistics.setLogisticsStatus("pending");
        logistics.setCreateTime(new Date());
        logistics.setUpdateTime(new Date());
        int result = logisticsMapper.insert(logistics);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PostMapping("/{id}/status")
    public ApiResponse<Boolean> updateLogisticsStatus(@PathVariable Long id, @RequestBody java.util.Map<String, Object> params) {
        Logistics logistics = logisticsMapper.selectById(id);
        if (logistics == null) return ApiResponse.error("物流订单不存在");

        String status = (String) params.get("status");
        logistics.setLogisticsStatus(status);

        // 时间戳各自归位：原先 in_transit 会把 delivery_time（送达时间）写掉 ——
        // 货还在路上，"已送达时间"就已经有了，之后谁也分不清到底送到了没有。
        // 取值按本控制器 getStatusDescription 里的词表：pending / picked / in_transit /
        // delivering / delivered（delivered 即已签收）。
        if ("picked".equals(status)) {
            logistics.setPickupTime(new Date());
        } else if ("in_transit".equals(status) || "delivering".equals(status)) {
            // 运输中/派送中：只更新位置，不写任何"到达/签收"时间
        } else if ("delivered".equals(status) || "signed".equals(status)) {
            logistics.setDeliveryTime(new Date());
            logistics.setActualArrivalTime(new Date());
            logistics.setSignTime(new Date());
            logistics.setSignReceiver((String) params.get("signReceiver"));
        }

        logistics.setCurrentLocation((String) params.get("location"));
        logistics.setUpdateTime(new Date());
        
        int result = logisticsMapper.updateById(logistics);
        if (result > 0) {
            addTrace(id, status, (String) params.get("location"));
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新失败");
    }

    private void addTrace(Long logisticsId, String status, String location) {
        LogisticsTrace trace = new LogisticsTrace();
        trace.setLogisticsId(logisticsId);
        trace.setTraceNo("TR" + System.currentTimeMillis());
        trace.setTraceTime(new Date());
        trace.setTraceStatus(status);
        trace.setTraceLocation(location);
        trace.setTraceDescription(getStatusDescription(status));
        trace.setDelFlag(0);
        trace.setCreateTime(new Date());
        traceMapper.insert(trace);
    }

    private String getStatusDescription(String status) {
        return switch (status) {
            case "pending" -> "待揽收";
            case "picked" -> "已揽收";
            case "in_transit" -> "运输中";
            case "delivering" -> "派送中";
            case "delivered" -> "已签收";
            default -> status;
        };
    }
}
