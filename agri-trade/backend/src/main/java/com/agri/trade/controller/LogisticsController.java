package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Logistics;
import com.agri.trade.entity.LogisticsTrace;
import com.agri.trade.entity.Carrier;
import com.agri.trade.mapper.LogisticsMapper;
import com.agri.trade.mapper.LogisticsTraceMapper;
import com.agri.trade.mapper.CarrierMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/api/trade/logistics")
@RequiredArgsConstructor
public class LogisticsController {

    private final LogisticsMapper logisticsMapper;
    private final LogisticsTraceMapper traceMapper;
    private final CarrierMapper carrierMapper;
    private final TradeOrderMapper orderMapper;
    private final PlatformIdentityService identityService;

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

    /*
     * 承运商的新增已移到运营端 /api/trade/admin/carrier。
     *
     * 承运商是全平台共用的运力主数据（顺丰冷运、京东冷链…），原先的"新增承运商"
     * 挂在用户侧路径上且没有任何校验 —— 任何登录用户都能往平台运力库里加一条。
     * 上面的两个读接口保留：物流编辑时要选承运商。
     */

    @GetMapping("/page")
    public ApiResponse<IPage<Logistics>> getLogisticsPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) String logisticsStatus,
            // 列表页的搜索框一直在，但后端从来没收过 logisticsNo —— 输了字点搜索没有任何变化。
            @RequestParam(required = false) String logisticsNo) {
        Page<Logistics> page = new Page<>(pageNum, pageSize);
        // 这一页原先不带任何身份过滤：任何登录用户都能翻到全平台所有商家的物流单
        // （收货人、电话、地址都在里面）。改成只看"我是买方或卖方"的订单的物流。
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        List<Long> myOrderIds = myOrderIds(scope);
        if (myOrderIds.isEmpty()) {
            // 没有任何订单 → 返回空页（不能退化成"看全部"）
            return ApiResponse.success(page);
        }
        LambdaQueryWrapper<Logistics> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Logistics::getDelFlag, 0);
        wrapper.in(Logistics::getOrderId, myOrderIds);
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
        // 原先这里连判权都没有：任何登录用户能删掉别人订单下的物流单。
        String denied = denyIfNotOrderParty(logistics);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
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
        String denied = denyIfNotOrderParty(logistics);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        return ApiResponse.success(logistics);
    }

    @GetMapping("/{id}/traces")
    public ApiResponse<List<LogisticsTrace>> getLogisticsTraces(@PathVariable Long id) {
        Logistics logistics = logisticsMapper.selectById(id);
        if (logistics == null) return ApiResponse.error("物流订单不存在");
        String denied = denyIfNotOrderParty(logistics);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        LambdaQueryWrapper<LogisticsTrace> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(LogisticsTrace::getLogisticsId, id);
        wrapper.eq(LogisticsTrace::getDelFlag, 0);
        wrapper.orderByAsc(LogisticsTrace::getTraceTime);
        return ApiResponse.success(traceMapper.selectList(wrapper));
    }

    @PostMapping
    public ApiResponse<Boolean> createLogistics(@RequestBody Logistics logistics) {
        // 只能给自己参与的订单开物流单（否则任何用户都能往别人的订单上挂一张物流单）
        if (logistics.getOrderId() == null) {
            return ApiResponse.error("必须指定关联订单");
        }
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        if (!myOrderIds(scope).contains(logistics.getOrderId())) {
            return ApiResponse.error("只能为自己的订单创建物流单");
        }
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
        String denied = denyIfNotOrderParty(logistics);
        if (denied != null) {
            return ApiResponse.error(denied);
        }

        String status = (String) params.get("status");
        // 轨迹是"状态流转"的记录。编辑物流单时页面会把当前状态一并回传，
        // 原先这里无条件写轨迹 —— 用户只是改个承运商/运费，轨迹里也会多出一条
        // 一模一样的"运输中"，看轨迹分不清是真的动了货还是被人点了一下保存。
        String previousStatus = logistics.getLogisticsStatus();
        boolean statusChanged = !java.util.Objects.equals(status, previousStatus);
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
            if (statusChanged) {
                addTrace(id, status, (String) params.get("location"));
            }
            return ApiResponse.success(true);
        }
        return ApiResponse.error("更新失败");
    }

    /**
     * 修改物流单（承运商、类型、运费、收发信息、预计送达）。
     *
     * <p>原先没有任何"修改物流单"的接口 —— 物流单一旦创建，承运商就再也改不了
     * （页面上"编辑"只能改状态）。这里把该改的字段补上。</p>
     *
     * <p>判权：必须是这单所对应订单的当事人。与改状态同一套口径 ——
     * 否则任何登录用户都能改别人的承运商与收货信息。</p>
     */
    @PutMapping("/{id}")
    public ApiResponse<Boolean> updateLogistics(@PathVariable Long id, @RequestBody Logistics patch) {
        Logistics logistics = logisticsMapper.selectById(id);
        if (logistics == null) {
            return ApiResponse.error("物流订单不存在");
        }
        String denied = denyIfNotOrderParty(logistics);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        // 只允许改"安排运输"相关字段；状态走 /{id}/status（那会写轨迹），
        // 单号、订单号这些标识字段不允许改。
        if (patch.getCarrierId() != null) {
            Carrier carrier = carrierMapper.selectById(patch.getCarrierId());
            if (carrier == null) {
                return ApiResponse.error("承运商不存在");
            }
            logistics.setCarrierId(carrier.getId());
            // 承运商名以主数据为准，不采信请求体（否则会出现"改了个不存在的名字"）
            logistics.setCarrierName(carrier.getCarrierName());
        }
        if (patch.getLogisticsType() != null) logistics.setLogisticsType(patch.getLogisticsType());
        if (patch.getFreightAmount() != null) logistics.setFreightAmount(patch.getFreightAmount());
        if (patch.getSenderAddress() != null) logistics.setSenderAddress(patch.getSenderAddress());
        if (patch.getSenderContact() != null) logistics.setSenderContact(patch.getSenderContact());
        if (patch.getSenderPhone() != null) logistics.setSenderPhone(patch.getSenderPhone());
        if (patch.getReceiverAddress() != null) logistics.setReceiverAddress(patch.getReceiverAddress());
        if (patch.getReceiverContact() != null) logistics.setReceiverContact(patch.getReceiverContact());
        if (patch.getReceiverPhone() != null) logistics.setReceiverPhone(patch.getReceiverPhone());
        if (patch.getExpectDeliveryTime() != null) logistics.setExpectDeliveryTime(patch.getExpectDeliveryTime());
        // 物流表没有 remark 列（实体也没有该字段），所以这里没有备注可改。
        logistics.setUpdateTime(new Date());
        int result = logisticsMapper.updateById(logistics);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("修改失败");
    }

    /**
     * 判权：当前用户绑定的经营主体必须是这单物流所对应订单的买卖一方。
     *
     * @return 拒绝原因；允许时返回 null
     */
    private String denyIfNotOrderParty(Logistics logistics) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return scope.error();
        }
        if (logistics.getOrderId() == null) {
            // 没有关联订单的物流单（例如运营直接建的）只允许运营经手，
            // 用户端不做改动，避免"谁都能改一张无主单据"。
            return "该物流单没有关联订单，请联系运营调整";
        }
        TradeOrder order = orderMapper.selectById(logistics.getOrderId());
        if (order == null) {
            return "物流单关联的订单不存在，请联系运营核查";
        }
        if (scope.merchantIds().contains(order.getBuyerId())
                || scope.merchantIds().contains(order.getSellerId())) {
            return null;
        }
        return "只能操作与自己有关的物流单";
    }

    /** 当前主体作为买方或卖方参与过的订单 id。列表过滤与创建校验共用。 */
    private List<Long> myOrderIds(PlatformIdentityService.MerchantScope scope) {
        if (!scope.hasBinding()) {
            return List.of();
        }
        List<TradeOrder> orders = orderMapper.selectList(new LambdaQueryWrapper<TradeOrder>()
                .select(TradeOrder::getId)
                .and(w -> w.in(TradeOrder::getBuyerId, scope.merchantIds())
                        .or().in(TradeOrder::getSellerId, scope.merchantIds())));
        List<Long> ids = new ArrayList<>();
        for (TradeOrder order : orders) {
            ids.add(order.getId());
        }
        return ids;
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
