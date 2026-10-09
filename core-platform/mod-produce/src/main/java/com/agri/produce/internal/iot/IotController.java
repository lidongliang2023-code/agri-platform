package com.agri.produce.internal.iot;

import com.agri.produce.internal.common.DateParams;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * IoT 设备与监测读数（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/iot")
@RequiredArgsConstructor
public class IotController {

    private final IotDeviceService iotDeviceService;
    private final IotReadingService iotReadingService;
    private final IotCommandService iotCommandService;
    private final IotMaintenanceService iotMaintenanceService;
    private final IotBindingService iotBindingService;

    /**
     * 设备分页查询。
     *
     * <p>{@code status} 是<strong>档案状态</strong>（1启用 0停用）；
     * {@code runStatus} 是<strong>运行态</strong>（ONLINE 在线 / OFFLINE 离线，不传=全部），
     * 由 {@code online_flag + 最后心跳新鲜度} 实时判定。两者可叠加。</p>
     *
     * <p>注：故障态（FAULT）当前无数据支撑，传入会明确报错而不是静默返回空列表。</p>
     *
     * @param page      页码，默认 1
     * @param size      每页条数，默认 10
     * @param keyword   设备名称模糊关键字，可为空
     * @param status    档案状态 1启用 0停用，可为空
     * @param runStatus 运行态 ONLINE/OFFLINE，可为空
     * @return 设备分页结果
     */
    @GetMapping("/devices")
    public ApiResponse<PageResult<IotDeviceEntity>> pageIotDevice(@RequestParam(defaultValue = "1") long page,
                                                                  @RequestParam(defaultValue = "10") long size,
                                                                  @RequestParam(required = false) String keyword,
                                                                  @RequestParam(required = false) Integer status,
                                                                  @RequestParam(required = false) String runStatus) {
        return ApiResponse.ok(iotDeviceService.page(page, size, keyword, status, runStatus));
    }

    @GetMapping("/devices/{id}")
    public ApiResponse<IotDeviceEntity> detailIotDevice(@PathVariable String id) {
        return ApiResponse.ok(iotDeviceService.detail(id));
    }

    @PostMapping("/devices")
    public ApiResponse<String> createIotDevice(@RequestBody IotDeviceEntity entity) {
        return ApiResponse.ok(iotDeviceService.create(entity).getDeviceId());
    }

    @PutMapping("/devices/{id}")
    public ApiResponse<IotDeviceEntity> updateIotDevice(@PathVariable String id, @RequestBody IotDeviceEntity entity) {
        return ApiResponse.ok(iotDeviceService.update(id, entity));
    }

    @DeleteMapping("/devices/{id}")
    public ApiResponse<Void> deleteIotDevice(@PathVariable String id) {
        iotDeviceService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/readings")
    public ApiResponse<PageResult<IotReadingEntity>> pageIotReading(@RequestParam(defaultValue = "1") long page,
                                                                    @RequestParam(defaultValue = "10") long size) {
        return ApiResponse.ok(iotReadingService.page(page, size));
    }

    @GetMapping("/readings/{id}")
    public ApiResponse<IotReadingEntity> detailIotReading(@PathVariable String id) {
        return ApiResponse.ok(iotReadingService.detail(id));
    }

    @PostMapping("/readings")
    public ApiResponse<String> createIotReading(@RequestBody IotReadingEntity entity) {
        return ApiResponse.ok(iotReadingService.create(entity).getReadingId());
    }

    @PutMapping("/readings/{id}")
    public ApiResponse<IotReadingEntity> updateIotReading(@PathVariable String id, @RequestBody IotReadingEntity entity) {
        return ApiResponse.ok(iotReadingService.update(id, entity));
    }

    @DeleteMapping("/readings/{id}")
    public ApiResponse<Void> deleteIotReading(@PathVariable String id) {
        iotReadingService.delete(id);
        return ApiResponse.ok();
    }

    /** 设备心跳 */
    @PostMapping("/devices/{deviceId}/heartbeat")
    public ApiResponse<IotDeviceEntity> heartbeat(@PathVariable String deviceId) {
        return ApiResponse.ok(iotDeviceService.heartbeat(deviceId));
    }

    /** 离线设备 */
    @GetMapping("/devices/offline")
    public ApiResponse<List<IotDeviceEntity>> offline(@RequestParam(defaultValue = "10") int minutes) {
        return ApiResponse.ok(iotDeviceService.listOffline(minutes));
    }

    /** 最新读数 */
    @GetMapping("/readings/latest")
    public ApiResponse<IotReadingEntity> latest(@RequestParam String deviceId) {
        return ApiResponse.ok(iotReadingService.latest(deviceId));
    }

    /** 指标时序 */
    @GetMapping("/readings/series")
    public ApiResponse<List<IotReadingEntity>> series(@RequestParam String deviceId,
                                                      @RequestParam(required = false) String metric,
                                                      @RequestParam(required = false) String startDate,
                                                      @RequestParam(required = false) String endDate) {
        return ApiResponse.ok(iotReadingService.series(deviceId, null, metric,
                DateParams.parseDate(startDate), DateParams.parseDate(endDate)));
    }

    /** 设备遥测时序 */
    @GetMapping("/devices/{deviceId}/telemetry")
    public ApiResponse<List<IotReadingEntity>> telemetry(@PathVariable String deviceId,
                                                         @RequestParam(required = false) String metric,
                                                         @RequestParam(required = false) String startDate,
                                                         @RequestParam(required = false) String endDate) {
        return ApiResponse.ok(iotReadingService.series(deviceId, null, metric,
                DateParams.parseDate(startDate), DateParams.parseDate(endDate)));
    }

    // ------------------------------------------------------------------ 多指标环境趋势

    /**
     * 设备环境历史（多指标趋势）。
     *
     * <p>{@code metrics} 支持逗号分隔，规范码为 snake_case：
     * {@code air_temperature / air_humidity / soil_temperature / soil_moisture /
     * illuminance / co2 / rainfall}；也接受 camelCase（{@code airTemperature}）
     * 与常用别名（{@code temperature}、{@code humidity}）。
     * <b>不传 metrics 时默认 temperature</b>，与既有单指标调用行为一致。</p>
     *
     * <p>返回 {@code series}（指标 → 与 dates 等长的数值序列，缺失为 null）
     * 与 {@code temperatures}（{@code series.air_temperature} 的兼容别名）。</p>
     *
     * @param deviceId  设备业务主键
     * @param metrics   逗号分隔指标名，可为空
     * @param startDate 起始日期 yyyy-MM-dd，可为空
     * @param endDate   结束日期 yyyy-MM-dd，可为空
     * @return 环境趋势
     */
    @GetMapping("/devices/{deviceId}/env-history")
    public ApiResponse<EnvTrendVO> envHistory(@PathVariable String deviceId,
                                              @RequestParam(required = false) String metrics,
                                              @RequestParam(required = false) String startDate,
                                              @RequestParam(required = false) String endDate) {
        return ApiResponse.ok(iotReadingService.envHistory(deviceId, null, metrics,
                DateParams.parseDate(startDate), DateParams.parseDate(endDate)));
    }

    // ------------------------------------------------------------------ 指令下发与回执

    /**
     * 指令下发：服务端落库 PENDING 后按设备真实在线状态判定回执并持久化。
     *
     * @param deviceId    设备业务主键
     * @param commandType 指令类型，如 VALVE_SWITCH / IRRIGATE / REBOOT
     * @param params      指令参数（JSON 文本），可为空
     * @param operator    操作人
     * @return 已落库的指令（含最终状态 SUCCESS/FAILED 与回执内容）
     */
    @PostMapping("/devices/{deviceId}/commands")
    public ApiResponse<IotCommandEntity> sendCommand(@PathVariable String deviceId,
                                                     @RequestParam String commandType,
                                                     @RequestParam(required = false) String params,
                                                     @RequestParam(required = false) String operator) {
        return ApiResponse.ok(iotCommandService.send(deviceId, commandType, params, operator));
    }

    /**
     * 指令记录列表（指令记录 Tab）。
     *
     * @param deviceId 设备业务主键
     * @param status   状态过滤 PENDING/SUCCESS/FAILED，可为空
     * @param limit    返回条数上限，可为空（默认 100，上限 500）
     * @return 指令列表（按下发时间倒序）
     */
    @GetMapping("/devices/{deviceId}/commands")
    public ApiResponse<List<IotCommandEntity>> listCommands(@PathVariable String deviceId,
                                                            @RequestParam(required = false) String status,
                                                            @RequestParam(required = false) Integer limit) {
        return ApiResponse.ok(iotCommandService.listByDevice(deviceId, status, limit));
    }

    /** 指令详情 */
    @GetMapping("/commands/{commandId}")
    public ApiResponse<IotCommandEntity> commandDetail(@PathVariable String commandId) {
        return ApiResponse.ok(iotCommandService.detail(commandId));
    }

    /**
     * 设备真实回执回调（satellite-iot 推送时调用），覆盖服务端预判结果。
     *
     * @param commandId 指令业务主键
     * @param success   是否执行成功
     * @param receipt   回执内容，可为空
     * @return 更新后的指令
     */
    @PostMapping("/commands/{commandId}/receipt")
    public ApiResponse<IotCommandEntity> commandReceipt(@PathVariable String commandId,
                                                        @RequestParam(defaultValue = "true") boolean success,
                                                        @RequestParam(required = false) String receipt) {
        return ApiResponse.ok(iotCommandService.receipt(commandId, success, receipt));
    }

    /** 指令分页查询（跨设备） */
    @GetMapping("/commands")
    public ApiResponse<PageResult<IotCommandEntity>> pageCommands(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String status) {
        return ApiResponse.ok(iotCommandService.page(page, size, deviceId, status));
    }

    // ------------------------------------------------------------------ 维修记录

    /** 新增维修记录 */
    @PostMapping("/devices/{deviceId}/maintenances")
    public ApiResponse<IotMaintenanceEntity> createMaintenance(@PathVariable String deviceId,
                                                               @RequestBody IotMaintenanceEntity entity) {
        return ApiResponse.ok(iotMaintenanceService.create(deviceId, entity));
    }

    /** 维修记录列表 */
    @GetMapping("/devices/{deviceId}/maintenances")
    public ApiResponse<List<IotMaintenanceEntity>> listMaintenances(
            @PathVariable String deviceId,
            @RequestParam(required = false) Integer limit) {
        return ApiResponse.ok(iotMaintenanceService.listByDevice(deviceId, limit));
    }

    /** 维修记录详情 */
    @GetMapping("/maintenances/{maintainId}")
    public ApiResponse<IotMaintenanceEntity> maintenanceDetail(@PathVariable String maintainId) {
        return ApiResponse.ok(iotMaintenanceService.detail(maintainId));
    }

    /** 更新维修记录 */
    @PutMapping("/maintenances/{maintainId}")
    public ApiResponse<IotMaintenanceEntity> updateMaintenance(@PathVariable String maintainId,
                                                               @RequestBody IotMaintenanceEntity entity) {
        return ApiResponse.ok(iotMaintenanceService.update(maintainId, entity));
    }

    /** 删除维修记录 */
    @DeleteMapping("/maintenances/{maintainId}")
    public ApiResponse<Void> deleteMaintenance(@PathVariable String maintainId) {
        iotMaintenanceService.delete(maintainId);
        return ApiResponse.ok();
    }

    /** 维修记录分页查询（跨设备） */
    @GetMapping("/maintenances")
    public ApiResponse<PageResult<IotMaintenanceEntity>> pageMaintenances(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String deviceId) {
        return ApiResponse.ok(iotMaintenanceService.page(page, size, deviceId));
    }

    // ------------------------------------------------------------------ 绑定关系

    /**
     * 绑定关系列表（真正的绑定关系记录，采集指标以数组返回）。
     *
     * @param deviceId     设备业务主键，可为空
     * @param bindType     绑定对象类型 PLOT/GREENHOUSE/FARM，可为空
     * @param bindTargetId 绑定对象ID（地块ID/大棚ID/农场ID），可为空
     * @param status       状态过滤，为空时默认只返回 BOUND
     * @return 绑定关系视图对象列表
     */
    @GetMapping("/bindings")
    public ApiResponse<List<IotBindingVO>> bindings(@RequestParam(required = false) String deviceId,
                                                    @RequestParam(required = false) String bindType,
                                                    @RequestParam(required = false) String bindTargetId,
                                                    @RequestParam(required = false) String status) {
        return ApiResponse.ok(iotBindingService.list(deviceId, bindType, bindTargetId, status));
    }

    /**
     * 建立绑定关系。
     *
     * @param deviceId     设备业务主键
     * @param bindType     绑定对象类型 PLOT/GREENHOUSE/FARM
     * @param bindTargetId 绑定对象ID
     * @param targetName   绑定对象名称，可为空
     * @param metrics      采集指标（逗号分隔，如 temperature,humidity），可为空
     * @param frequency    采集频率（分钟），可为空
     * @return 绑定关系视图对象
     */
    @PostMapping("/bindings")
    public ApiResponse<IotBindingVO> bind(@RequestParam String deviceId,
                                          @RequestParam(defaultValue = "PLOT") String bindType,
                                          @RequestParam String bindTargetId,
                                          @RequestParam(required = false) String targetName,
                                          @RequestParam(required = false) String metrics,
                                          @RequestParam(required = false) Integer frequency) {
        return ApiResponse.ok(iotBindingService.bind(deviceId, bindType, bindTargetId,
                targetName, metrics, frequency));
    }

    /** 绑定关系分页查询 */
    @GetMapping("/bindings/page")
    public ApiResponse<PageResult<IotBindingVO>> pageBindings(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String bindType,
            @RequestParam(required = false) String status) {
        return ApiResponse.ok(iotBindingService.page(page, size, deviceId, bindType, status));
    }

    /** 绑定关系详情 */
    @GetMapping("/bindings/{bindingId}")
    public ApiResponse<IotBindingVO> bindingDetail(@PathVariable String bindingId) {
        return ApiResponse.ok(IotBindingVO.of(iotBindingService.detail(bindingId)));
    }

    /** 解绑 */
    @PostMapping("/bindings/{bindingId}/unbind")
    public ApiResponse<IotBindingVO> unbind(@PathVariable String bindingId) {
        return ApiResponse.ok(iotBindingService.unbind(bindingId));
    }

    /** 变更绑定状态 BOUND/UNBOUND/PAUSED */
    @PostMapping("/bindings/{bindingId}/status")
    public ApiResponse<IotBindingVO> changeBindingStatus(@PathVariable String bindingId,
                                                         @RequestParam String status) {
        return ApiResponse.ok(iotBindingService.changeStatus(bindingId, status));
    }
}
