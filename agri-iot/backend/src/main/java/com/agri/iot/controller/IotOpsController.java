package com.agri.iot.controller;

import com.agri.common.result.ApiResponse;
import com.agri.iot.repository.IotAlertRuleRepository;
import com.agri.iot.repository.IotOpsRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import com.agri.common.rbac.OperatorOnly;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/iot/ops")
@OperatorOnly("iot:admin")
public class IotOpsController {
    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.integration.ProductionFarmClient otaFarms;
    public record OtaStart(List<Long> gatewayIds,String firmwareUrl) {}
    private final IotOpsRepository repository;
    private final IotAlertRuleRepository ruleRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.service.FirmwarePackageService firmwarePackageService;

    public IotOpsController(IotOpsRepository repository, IotAlertRuleRepository ruleRepository) {
        this.repository = repository;
        this.ruleRepository = ruleRepository;
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.service.DeviceCommandService commandService;
    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.integration.IotIdentityService commandIdentity;
    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.service.OtaCommandService otaCommands;
    @GetMapping("/gateways/{id}/ota")
    public ApiResponse<List<Map<String,Object>>> otaHistory(@PathVariable long id,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size){
        commandIdentity.requireOperatorName();
        return ApiResponse.success(otaCommands.history(id,page,size));
    }
    @GetMapping("/devices/{id}/commands")
    public ApiResponse<List<Map<String,Object>>> commandHistory(@PathVariable long id,
            @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size) {
        commandIdentity.requireOperatorName();
        return ApiResponse.success(commandService.history(id,page,size));
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.service.GatewayCommandService gatewayCommands;
    @GetMapping("/gateways/{id}/commands")
    public ApiResponse<List<Map<String,Object>>> gatewayHistory(@PathVariable long id,
            @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size) {

        commandIdentity.requireOperatorName();
        return ApiResponse.success(gatewayCommands.history(id,page,size));
    }

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() { return ApiResponse.success(repository.overview()); }

    @GetMapping("/tenants")
    public ApiResponse<List<Map<String, Object>>> tenants() { return ApiResponse.success(repository.tenants()); }

    @PostMapping("/tenants/{id}/quota")
    public ApiResponse<Map<String, Object>> updateQuota(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("租户配额已更新", repository.updateTenantQuota(id, body));
    }

    @GetMapping("/devices")
    public ApiResponse<List<Map<String, Object>>> devices(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(repository.devices(keyword, status));
    }

    @GetMapping("/gateways")
    public ApiResponse<List<Map<String, Object>>> gateways() { return ApiResponse.success(repository.gateways()); }

    @PostMapping("/gateways/{id}/restart")
    public ApiResponse<Map<String, Object>> restartGateway(@PathVariable long id) {
        return ApiResponse.success(repository.restartGateway(id));
    }

    @GetMapping("/alerts")
    public ApiResponse<List<Map<String, Object>>> alerts() { return ApiResponse.success(repository.alerts()); }

    @PostMapping("/alerts/{id}/handle")
    public ApiResponse<Map<String, Object>> handleAlert(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("告警已处置", repository.handleAlert(id, body));
    }

    /**
     * 平台预置阈值规则。
     *
     * <p>{@code enabled} 是全平台开关，所以启停只有运营能做（用户端上一轮已下线）；
     * 每一次启停都会以令牌账号写入审计留痕。</p>
     */
    @GetMapping("/alert-rules")
    public ApiResponse<List<Map<String, Object>>> alertRules() {
        return ApiResponse.success(ruleRepository.platformRules());
    }

    @PostMapping("/alert-rules/{id}/toggle")
    public ApiResponse<Map<String, Object>> toggleAlertRule(@PathVariable long id) {
        return ApiResponse.success("平台阈值规则状态已更新", ruleRepository.togglePlatformRule(id));
    }

    /** 各经营主体的自定义阈值：运营要能看出"为什么这家报警、那家不报"。 */
    @GetMapping("/alert-rules/tenant")
    public ApiResponse<List<Map<String, Object>>> tenantAlertRules() {
        return ApiResponse.success(ruleRepository.allTenantRules());
    }

    @GetMapping("/products")
    public ApiResponse<List<Map<String, Object>>> products() { return ApiResponse.success(repository.products()); }

    @GetMapping("/protocols")
    public ApiResponse<List<Map<String, Object>>> protocols() { return ApiResponse.success(repository.protocols()); }

    @GetMapping("/access-audits")
    public ApiResponse<List<Map<String, Object>>> accessAudits() {
        return ApiResponse.success(repository.accessAudits());
    }

    @PostMapping("/access-audits/{id}/review")
    public ApiResponse<Map<String, Object>> reviewAccess(
            @PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success("接入审核完成", repository.reviewAccess(id, body));
    }

    @GetMapping("/ota")
    public ApiResponse<List<Map<String, Object>>> otaTasks() {
        otaCommands.refreshTasks();
        return ApiResponse.success(repository.otaTasks());
    }

    @PostMapping("/ota/{id}/execute")
    public ApiResponse<Map<String, Object>> executeOta(@PathVariable long id,@RequestBody OtaStart body) {
        return ApiResponse.success(otaCommands.start(id,body.gatewayIds(),body.firmwareUrl(),commandIdentity.requireOperatorName(),otaFarms.listCurrentTenantFarms()));
    }

    @GetMapping("/work-orders")
    public ApiResponse<List<Map<String, Object>>> workOrders() {
        return ApiResponse.success(repository.workOrders());
    }

    @PostMapping("/work-orders/{id}/handle")
    public ApiResponse<Map<String, Object>> handleWorkOrder(@PathVariable long id, @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.handleWorkOrder(id, body));
    }

    @GetMapping("/logs")
    public ApiResponse<List<Map<String, Object>>> logs() { return ApiResponse.success(repository.logs()); }

    @GetMapping("/reports")
    public ApiResponse<Map<String, Object>> reports() { return ApiResponse.success(repository.reports()); }

    // ====== 固件包管理接口 ======
    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.iot.service.FirmwareStorageService firmwareStorage;

    @PostMapping(value="/firmware/packages/upload",consumes="multipart/form-data")
    public ApiResponse<Map<String,Object>> uploadFirmware(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam(required=false) String expectedSha256) {
        commandIdentity.requireOperatorName();
        return ApiResponse.success(firmwareStorage.upload(file,expectedSha256));
    }

    @GetMapping("/firmware/packages")
    public ApiResponse<List<Map<String, Object>>> listFirmwarePackages(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(firmwarePackageService.list(type, model, status));
    }

    @GetMapping("/firmware/packages/{id}")
    public ApiResponse<Map<String, Object>> getFirmwarePackage(@PathVariable long id) {
        return ApiResponse.success(firmwarePackageService.get(id));
    }

    @PostMapping("/firmware/packages")
    public ApiResponse<Map<String, Object>> registerFirmwarePackage(@RequestBody Map<String, Object> payload) {
        return ApiResponse.success(firmwarePackageService.register(payload));
    }

    @PostMapping("/firmware/packages/{id}/publish")
    public ApiResponse<Map<String, Object>> publishFirmwarePackage(@PathVariable long id) {
        return ApiResponse.success(firmwarePackageService.publish(id));
    }

    @PostMapping("/firmware/packages/{id}/deprecate")
    public ApiResponse<Map<String, Object>> deprecateFirmwarePackage(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        String reason = body != null ? java.util.Objects.toString(body.get("reason"), "") : "";
        return ApiResponse.success(firmwarePackageService.deprecate(id, reason));
    }

}
