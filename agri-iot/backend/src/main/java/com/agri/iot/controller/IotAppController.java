package com.agri.iot.controller;

import com.agri.common.result.ApiResponse;
import com.agri.iot.repository.IotAlertRuleRepository;
import com.agri.iot.repository.IotAppRepository;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/iot/app")
public class IotAppController {
    private final IotAppRepository repository;
    private final IotAlertRuleRepository ruleRepository;

    public IotAppController(IotAppRepository repository, IotAlertRuleRepository ruleRepository) {
        this.repository = repository;
        this.ruleRepository = ruleRepository;
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.service.DeviceCommandService commandService;
    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.integration.IotIdentityService commandIdentity;
    @GetMapping("/devices/{id}/commands")
    public ApiResponse<List<Map<String,Object>>> commandHistory(@PathVariable long id,
            @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size) {
        commandIdentity.requireDeviceAccess(id);
        return ApiResponse.success(commandService.history(id,page,size));
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.service.GatewayCommandService gatewayCommands;
    @GetMapping("/gateways/{id}/commands")
    public ApiResponse<List<Map<String,Object>>> gatewayHistory(@PathVariable long id,
            @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size) {
        commandIdentity.requireGateway(id);
        return ApiResponse.success(gatewayCommands.history(id,page,size));
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.service.OtaCommandService otaCommands;
    @GetMapping("/gateways/{id}/ota")
    public ApiResponse<List<Map<String,Object>>> otaHistory(@PathVariable long id,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size){
        commandIdentity.requireGateway(id);
        return ApiResponse.success(otaCommands.history(id,page,size));
    }
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() { return ApiResponse.success(repository.overview()); }

    @GetMapping("/devices")
    public ApiResponse<List<Map<String, Object>>> devices(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) Long plotId) {
        return ApiResponse.success(repository.devices(keyword, status, groupId, plotId));
    }

    @GetMapping("/devices/{id}")
    public ApiResponse<Map<String, Object>> device(@PathVariable long id) {
        return ApiResponse.success(repository.device(id));
    }

    @GetMapping("/device-types")
    public ApiResponse<List<Map<String, Object>>> deviceTypes() {
        return ApiResponse.success(repository.deviceTypes());
    }

    /**
     * 设备数量统计（按在线状态分档，可按农场过滤）。
     *
     * <p>生产管理的管理端大盘 / 农场详情 / 报表 / AI 助手都需要"共几台、在线几台"。
     * 设备台账已经收敛到这里，那些统计就必须来这里取数 —— 否则它们读的还是
     * 生产端那张不再更新的历史副本，页面上会出现"设备列表 29 台、大盘 13 台"。</p>
     *
     * <p>路径用 {@code /device-stats} 而不是 {@code /devices/stats}：后者会被
     * {@code /devices/{id}} 抢走，{@code "stats"} 转 long 失败直接 400。</p>
     */
    @GetMapping("/device-stats")
    public ApiResponse<Map<String, Object>> deviceStats(
            @RequestParam(required = false) Long farmId) {
        return ApiResponse.success(repository.deviceStats(farmId));
    }

    @PostMapping("/devices")
    public ApiResponse<Map<String, Object>> createDevice(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("设备注册成功", repository.createDevice(body));
    }

    /**
     * 更新设备。
     *
     * <p>生产管理模块把设备绑定到地块后，会调这里回写 {@code plotId}，
     * 保证「生产端看到的设备归属」和「物联网端看到的」是同一个值。</p>
     */
    @PutMapping("/devices/{id}")
    public ApiResponse<Map<String, Object>> updateDevice(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("设备已更新", repository.updateDevice(id, body));
    }

    @PostMapping("/devices/{id}/control")
    public ApiResponse<Map<String, Object>> control(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("控制申请已登记", repository.controlDevice(id, body));
    }

    @GetMapping("/plots")
    public ApiResponse<List<Map<String, Object>>> plots() { return ApiResponse.success(repository.plots()); }

    @GetMapping("/farms")
    public ApiResponse<List<Map<String, Object>>> farms() { return ApiResponse.success(repository.farms()); }

    @GetMapping("/groups")
    public ApiResponse<List<Map<String, Object>>> groups() { return ApiResponse.success(repository.groups()); }

    @GetMapping("/gateways")
    public ApiResponse<List<Map<String, Object>>> gateways() { return ApiResponse.success(repository.gateways()); }

    @PostMapping("/gateways")
    public ApiResponse<Map<String, Object>> createGateway(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("边缘网关已创建", repository.createGateway(body));
    }

    @GetMapping("/gateways/{id}")
    public ApiResponse<Map<String, Object>> gateway(@PathVariable long id) {
        return ApiResponse.success(repository.gateway(id));
    }

    @PutMapping("/gateways/{id}")
    public ApiResponse<Map<String, Object>> updateGateway(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("边缘网关已更新", repository.updateGateway(id, body));
    }

    @DeleteMapping("/gateways/{id}")
    public ApiResponse<Map<String, Object>> deleteGateway(@PathVariable long id) {
        return ApiResponse.success("边缘网关已删除", repository.deleteGateway(id));
    }

    @PostMapping("/gateways/{id}/restart")
    public ApiResponse<Map<String, Object>> restartGateway(@PathVariable long id) {
        return ApiResponse.success("重启指令已下发，网关状态以上线心跳为准", repository.restartGateway(id));
    }

    @GetMapping("/alerts")
    public ApiResponse<List<Map<String, Object>>> alerts(@RequestParam(required = false) String status) {
        return ApiResponse.success(repository.alerts(status));
    }

    @PostMapping("/alerts/{id}/handle")
    public ApiResponse<Map<String, Object>> handleAlert(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("告警已处置", repository.handleAlert(id, body));
    }

    /**
     * 平台预置阈值：用户端只读。
     *
     * <p>这里以前还有一个 {@code POST /alert-rules/{id}/toggle}。这张表没有租户列、
     * {@code enabled} 是全局开关，任何一个经营主体点"停用"就把全平台的同类告警关掉了，
     * 属于跨主体写入，已下线；主体自己的阈值走下面的 {@code /alert-rules/custom}。</p>
     */
    @GetMapping("/alert-rules")
    public ApiResponse<List<Map<String, Object>>> alertRules() {
        return ApiResponse.success(repository.alertRules());
    }

    /** 一份完整视图：平台预置（标出被哪条主体规则覆盖）+ 我的阈值规则 + 合并后的生效集合。 */
    @GetMapping("/alert-rules/view")
    public ApiResponse<Map<String, Object>> alertRuleView() {
        return ApiResponse.success(ruleRepository.ruleView());
    }

    /** 可配置的指标目录（设备类型声明的属性 + 本主体实际有读数的指标）、比较符、等级。 */
    @GetMapping("/alert-rules/options")
    public ApiResponse<Map<String, Object>> alertRuleOptions() {
        return ApiResponse.success(Map.of(
                "metrics", ruleRepository.metricOptions(),
                "deviceTypes", ruleRepository.deviceTypeNames(),
                "operators", com.agri.iot.support.IotMetrics.OPERATORS,
                "levels", com.agri.iot.support.IotMetrics.LEVELS
        ));
    }

    @PostMapping("/alert-rules/custom")
    public ApiResponse<Map<String, Object>> createAlertRule(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("阈值规则已保存", ruleRepository.createTenantRule(body));
    }

    @PutMapping("/alert-rules/custom/{id}")
    public ApiResponse<Map<String, Object>> updateAlertRule(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("阈值规则已更新", ruleRepository.updateTenantRule(id, body));
    }

    @DeleteMapping("/alert-rules/custom/{id}")
    public ApiResponse<Map<String, Object>> deleteAlertRule(@PathVariable long id) {
        return ApiResponse.success("阈值规则已删除", ruleRepository.deleteTenantRule(id));
    }

    @PostMapping("/alert-rules/custom/{id}/toggle")
    public ApiResponse<Map<String, Object>> toggleAlertRule(@PathVariable long id) {
        return ApiResponse.success(ruleRepository.toggleTenantRule(id));
    }

    /**
     * 阈值试算（GET：只是判定，不写任何数据，所以按读权限放行）。
     *
     * <p>采集侧将来接上之后，判定读数是否越线就走这同一套规则，页面与真实告警不会两套口径。</p>
     */
    @GetMapping("/alert-rules/evaluate")
    public ApiResponse<Map<String, Object>> evaluateAlertRule(
            @RequestParam String metricKey,
            @RequestParam String value,
            @RequestParam(required = false) String deviceType) {
        java.util.Map<String, Object> query = new java.util.LinkedHashMap<>();
        query.put("metricKey", metricKey);
        query.put("value", value);
        query.put("deviceType", deviceType);
        return ApiResponse.success(ruleRepository.evaluate(query));
    }

    /** 风险读数：本主体设备里，最近一次读数已按生效阈值越线的指标（含"持续时间"是否满足）。 */
    @GetMapping("/alert-rules/risk-readings")
    public ApiResponse<List<Map<String, Object>>> riskReadings() {
        return ApiResponse.success(ruleRepository.riskReadings());
    }

    @GetMapping("/scenes")
    public ApiResponse<List<Map<String, Object>>> scenes() { return ApiResponse.success(repository.scenes()); }

    @PostMapping("/scenes")
    public ApiResponse<Map<String, Object>> createScene(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("场景已创建", repository.createScene(body));
    }

    @PutMapping("/scenes/{id}")
    public ApiResponse<Map<String, Object>> updateScene(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("场景已更新", repository.updateScene(id, body));
    }

    @DeleteMapping("/scenes/{id}")
    public ApiResponse<Map<String, Object>> deleteScene(@PathVariable long id) {
        return ApiResponse.success("场景已删除", repository.deleteScene(id));
    }

    @PostMapping("/scenes/{id}/activate")
    public ApiResponse<Map<String, Object>> activateScene(@PathVariable long id) {
        return ApiResponse.success("场景已启用", repository.activateScene(id));
    }

    @GetMapping("/rules")
    public ApiResponse<List<Map<String, Object>>> rules() { return ApiResponse.success(repository.rules()); }

    @PostMapping("/rules")
    public ApiResponse<Map<String, Object>> createRule(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("自动化规则已创建", repository.createRule(body));
    }

    @PutMapping("/rules/{id}")
    public ApiResponse<Map<String, Object>> updateRule(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("自动化规则已更新", repository.updateRule(id, body));
    }

    @DeleteMapping("/rules/{id}")
    public ApiResponse<Map<String, Object>> deleteRule(@PathVariable long id) {
        return ApiResponse.success("自动化规则已删除", repository.deleteRule(id));
    }

    @PostMapping("/rules/{id}/toggle")
    public ApiResponse<Map<String, Object>> toggleRule(@PathVariable long id) {
        return ApiResponse.success(repository.toggleRule(id));
    }

    @PostMapping("/rules/{id}/execute")
    public ApiResponse<Map<String, Object>> executeRule(@PathVariable long id) {
        return ApiResponse.success("规则已手动执行", repository.executeRule(id));
    }

    @GetMapping("/reports")
    public ApiResponse<Map<String, Object>> reports() { return ApiResponse.success(repository.reports()); }

    @GetMapping("/work-orders")
    public ApiResponse<List<Map<String, Object>>> workOrders() {
        return ApiResponse.success(repository.workOrders());
    }

    @PostMapping("/work-orders")
    public ApiResponse<Map<String, Object>> createWorkOrder(@RequestBody Map<String, Object> body) {
        return ApiResponse.success("运维工单已创建", repository.createWorkOrder(body));
    }

    @GetMapping("/firmware")
    public ApiResponse<List<Map<String, Object>>> firmware() { return ApiResponse.success(repository.firmware()); }

    @GetMapping("/ota")
    public ApiResponse<List<Map<String, Object>>> ota() { return ApiResponse.success(repository.otaTasks()); }

    @GetMapping("/messages")
    public ApiResponse<List<Map<String, Object>>> messages() { return ApiResponse.success(repository.messages()); }

    @PostMapping("/messages/{id}/read")
    public ApiResponse<Map<String, Object>> readMessage(@PathVariable long id) {
        return ApiResponse.success(repository.readMessage(id));
    }

    @PostMapping("/messages/read-all")
    public ApiResponse<Map<String, Object>> readAll() { return ApiResponse.success(repository.readAllMessages()); }

    @GetMapping("/mobile/overview")
    public ApiResponse<Map<String, Object>> mobileOverview() {
        return ApiResponse.success(repository.mobileOverview());
    }

    @PostMapping("/mobile/sync")
    public ApiResponse<Map<String, Object>> mobileSync() {
        return ApiResponse.success("离线数据同步完成", repository.mobileSync());
    }
}
