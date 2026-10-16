package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IIotOpsService;
import com.agri.production.service.ISensorPivotService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.IotBindingVO;
import com.agri.production.vo.IotCommandVO;
import com.agri.production.vo.IotDeviceVO;
import com.agri.production.vo.IotMaintenanceVO;
import com.agri.production.vo.IotReadingVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * IoT 设备运维：绑定 / 指令 / 心跳 / 维修 / 读数（{@code /api/v1/production/iot}）。
 *
 * <p>页面用到的路径：设备绑定（/bindings、/bindings/page、/bindings/{id}/unbind）、
 * 设备详情（/devices/{id}/commands、/devices/{id}/maintenances、/devices/{id}/heartbeat）、
 * 环境数据与设备详情曲线（/readings/latest、/readings/series）。</p>
 *
 * <p><b>读数两条端点直接复用 {@link ISensorPivotService}</b>：它们与
 * {@code /growth/environment} 读的是同一张长表、同一套指标别名 —— 写两遍必然在某处漂移。</p>
 */
@RestController
@RequestMapping("/api/v1/production/iot")
public class IotOpsController {

    private final IIotOpsService opsService;
    private final ISensorPivotService pivotService;

    public IotOpsController(IIotOpsService opsService, ISensorPivotService pivotService) {
        this.opsService = opsService;
        this.pivotService = pivotService;
    }

    /* ==================== 绑定关系 ==================== */

    /** 绑定关系列表（不传 status 时只返回已绑定）。 */
    @GetMapping("/bindings")
    public ApiResponse<List<IotBindingVO>> bindings(
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String bindType,
            @RequestParam(required = false) String bindTargetId,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(opsService.listBindings(TenantContextService.currentTenantId(),
                new IIotOpsService.BindingQuery(deviceId, bindType, bindTargetId, status)));
    }

    /** 绑定关系分页（页面「设备绑定」列表）。 */
    @GetMapping("/bindings/page")
    public ApiResponse<PageResult<IotBindingVO>> pageBindings(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String bindType,
            @RequestParam(required = false) String bindTargetId,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(opsService.pageBindings(TenantContextService.currentTenantId(),
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                new IIotOpsService.BindingQuery(deviceId, bindType, bindTargetId, status)));
    }

    /** 建立绑定（参数走 query，与页面一致；同设备+类型+对象重复绑定时重新置为 BOUND）。 */
    @PostMapping("/bindings")
    public ApiResponse<IotBindingVO> bind(
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String bindType,
            @RequestParam(required = false) String bindTargetId,
            @RequestParam(required = false) String targetName,
            @RequestParam(required = false) String metrics,
            @RequestParam(required = false) Integer frequency) {
        return ApiResponse.success(opsService.bind(TenantContextService.currentTenantId(),
                new IIotOpsService.BindPayload(deviceId, bindType, bindTargetId, targetName,
                        splitList(metrics), frequency)));
    }

    /** 解绑（记录保留，状态置 UNBOUND）。 */
    @PostMapping("/bindings/{bindingId}/unbind")
    public ApiResponse<IotBindingVO> unbind(@PathVariable String bindingId) {
        return ApiResponse.success(opsService.unbind(TenantContextService.currentTenantId(), bindingId));
    }

    /* ==================== 指令 ==================== */

    /**
     * 记录一条设备指令。

     *
     * <p><b>只记录、不真下发</b>：本部署没有设备通道，返回体里 status=ISSUED、delivery=record-only、
     * 回执写明未送达 —— 页面据此展示"已记录（本部署未接下发通道）"，而不是一个点了没反应的假按钮。</p>
     */
    @PostMapping("/devices/{deviceId}/commands")
    public ApiResponse<IotCommandVO> sendCommand(
            @PathVariable String deviceId,
            @RequestParam(required = false) String commandType,
            @RequestParam(required = false) String params,
            @RequestParam(required = false) String operator) {
        return ApiResponse.success(opsService.sendCommand(TenantContextService.currentTenantId(),
                deviceId, commandType, params, operator));
    }

    /** 某设备的指令记录。 */
    @GetMapping("/devices/{deviceId}/commands")
    public ApiResponse<List<IotCommandVO>> commands(
            @PathVariable String deviceId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer limit) {
        return ApiResponse.success(opsService.listCommands(
                TenantContextService.currentTenantId(), deviceId, status, limit));
    }

    /* ==================== 心跳 ==================== */

    /** 设备心跳上报。 */
    @PostMapping("/devices/{deviceId}/heartbeat")
    public ApiResponse<IotDeviceVO> heartbeat(@PathVariable String deviceId) {
        return ApiResponse.success(opsService.heartbeat(TenantContextService.currentTenantId(), deviceId));
    }

    /* ==================== 维修 ==================== */

    /** 登记维修/保养记录。 */
    @PostMapping("/devices/{deviceId}/maintenances")
    public ApiResponse<IotMaintenanceVO> createMaintenance(
            @PathVariable String deviceId,
            @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body == null ? Map.of() : body;
        return ApiResponse.success(opsService.createMaintenance(TenantContextService.currentTenantId(), deviceId,
                new IIotOpsService.MaintenancePayload(
                        str(payload.get("maintainType")),
                        str(payload.get("content")),
                        str(payload.get("operator")),
                        str(payload.get("maintainAt")),
                        str(payload.get("result")),
                        str(payload.get("nextMaintainAt")))));
    }

    /** 某设备的维修记录。 */
    @GetMapping("/devices/{deviceId}/maintenances")
    public ApiResponse<List<IotMaintenanceVO>> maintenances(
            @PathVariable String deviceId,
            @RequestParam(required = false) Integer limit) {
        return ApiResponse.success(opsService.listMaintenances(
                TenantContextService.currentTenantId(), deviceId, limit));
    }

    /* ==================== 读数 ==================== */

    /** 设备最新一条读数（没有读数时 data 为 null，页面显示空态）。 */
    @GetMapping("/readings/latest")
    public ApiResponse<IotReadingVO> latestReading(@RequestParam(required = false) String deviceId) {
        return ApiResponse.success(pivotService.latest(TenantContextService.currentTenantId(), deviceId));
    }

    /** 设备读数时序（按采集时间升序）。 */
    @GetMapping("/readings/series")
    public ApiResponse<List<IotReadingVO>> readingSeries(
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String metric,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        return ApiResponse.success(pivotService.series(
                TenantContextService.currentTenantId(), deviceId, metric, startDate, endDate));
    }

    /* ==================== 参数小工具 ==================== */

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    /** 逗号串 → 指标列表（页面既发逗号串、也可能发数组，这里按串处理）。 */
    private static List<String> splitList(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        List<String> result = new ArrayList<>();
        for (String part : raw.split("[,，]")) {
            String item = part.trim();
            if (!item.isEmpty()) {
                result.add(item);
            }
        }
        return result;
    }

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }
}
