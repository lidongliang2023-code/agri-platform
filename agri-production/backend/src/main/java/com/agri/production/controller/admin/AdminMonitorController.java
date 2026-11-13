package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.service.IAdminMonitorService;
import com.agri.production.vo.AdminMonitorAlertVO;
import com.agri.production.vo.AdminMonitorDeviceVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：生产监控（{@code /api/v1/production/admin/monitor}）。
 *
 * <p>按前端契约 {@code api/admin/monitor.ts} 里**页面真的在调**的六条实现：
 * 监测总览 / 设备状态清单 / 实时告警流 / 任务状态聚合 / 催办任务 / 下发重启指令。
 * 对应页面是 {@code admin/monitor/{MonitorCenter,IotMonitor,TaskMonitor}}。</p>
 *
 * <p>不做租户过滤（运营端看全局），理由见 {@link com.agri.production.service.IAdminTraceService}。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/monitor")
public class AdminMonitorController {

    private final IAdminMonitorService adminMonitorService;

    public AdminMonitorController(IAdminMonitorService adminMonitorService) {
        this.adminMonitorService = adminMonitorService;
    }

    @org.springframework.beans.factory.annotation.Value("${platform.services.platform.url:http://localhost:8093}") private String platformUrl;
    private String actor(){
        try{
            var f=new org.springframework.http.client.SimpleClientHttpRequestFactory();f.setConnectTimeout(2000);f.setReadTimeout(3000);
            var h=new org.springframework.http.HttpHeaders();h.set("Authorization",com.agri.production.service.TenantContextService.currentAuthorization());
            var r=new org.springframework.web.client.RestTemplate(f).exchange(platformUrl+"/api/v1/auth/me",org.springframework.http.HttpMethod.GET,new org.springframework.http.HttpEntity<>(h),Map.class).getBody();
            if(r==null||!(r.get("data") instanceof Map u)||u.get("id")==null)throw new IllegalStateException();
            return String.valueOf(u.get("username"))+" · 用户 ID："+u.get("id");
        }catch(Exception e){throw new com.agri.production.common.exception.BusinessException(503,"无法确认运营操作人，催办未保存");}
    }
    /** 监测总览（MonitorCenter 走这条）。 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.success(adminMonitorService.overview());
    }

    /** 设备运行状态清单（IotMonitor 走这条；onlineOnly=true 只看在线）。 */
    @GetMapping("/devices")
    public ApiResponse<List<AdminMonitorDeviceVO>> devices(
            @RequestParam(defaultValue = "false") boolean onlineOnly) {
        return ApiResponse.success(adminMonitorService.devices(onlineOnly));
    }

    /** 实时告警流（MonitorCenter 走这条，默认近 60 分钟）。 */
    @GetMapping("/alerts")
    public ApiResponse<List<AdminMonitorAlertVO>> alerts(@RequestParam(defaultValue = "60") int minutes) {
        return ApiResponse.success(adminMonitorService.realtimeAlerts(minutes));
    }

    /** 任务状态聚合（MonitorCenter 走这条）。 */
    @GetMapping("/tasks")
    public ApiResponse<List<Map<String, Object>>> tasks() {
        return ApiResponse.success(adminMonitorService.taskStatusStats());
    }

    /** 催办任务（TaskMonitor 走这条）。 */
    @PatchMapping("/tasks/{taskId}/urge")
    public ApiResponse<Map<String, Object>> urge(@PathVariable Long taskId,
                                                @RequestParam(required = false) String operator) {
        return ApiResponse.success(adminMonitorService.urgeTask(taskId, actor()));
    }

    /**
     * 旧设备重启入口保留明确拒绝，设备指令由物联网域负责。
     *
     * <p>不写设备副本，不用登记时间冒充真实指令下发。</p>
     */
    @PatchMapping("/iot/{deviceId}/reboot")
    public ApiResponse<Map<String, Object>> reboot(@PathVariable Long deviceId,
                                                  @RequestParam(required = false) String operator) {
        return ApiResponse.success(adminMonitorService.requestReboot(deviceId, operator));
    }
    @org.springframework.beans.factory.annotation.Autowired private com.agri.production.service.ProductionMonitorQueryService query;
    @GetMapping("/task-page")
    public ApiResponse<?> taskPage(@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize,@RequestParam(required=false) String keyword,@RequestParam(required=false) Long farmId,@RequestParam(required=false) String status,@RequestParam(required=false) String taskType,@RequestParam(required=false) String startDate,@RequestParam(required=false) String endDate){return ApiResponse.success(query.taskPage(pageNum,pageSize,keyword,farmId,status,taskType,startDate,endDate));}
    @GetMapping("/task-detail/{id}") public ApiResponse<?> taskDetail(@PathVariable Long id){return ApiResponse.success(query.taskDetail(id));}
    @GetMapping("/input-page")
    public ApiResponse<?> inputPage(@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize,@RequestParam(required=false) String keyword,@RequestParam(required=false) Long farmId,@RequestParam(required=false) String startDate,@RequestParam(required=false) String endDate){return ApiResponse.success(query.inputPage(pageNum,pageSize,keyword,farmId,startDate,endDate));}
    @GetMapping("/environment") public ApiResponse<?> environment(@RequestParam Long farmId,@RequestParam(defaultValue="24") int hours){return ApiResponse.success(query.environment(farmId,hours));}
    @GetMapping("/alert-page") public ApiResponse<?> alertPage(@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize,@RequestParam(required=false) Long farmId,@RequestParam(required=false) String status){return ApiResponse.success(query.alertPage(pageNum,pageSize,farmId,status));}
    @GetMapping("/device-page") public ApiResponse<?> devicePage(@RequestHeader(value="Authorization",required=false) String authorization,@RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize,@RequestParam(required=false) String keyword,@RequestParam(required=false) String deviceType,@RequestParam(required=false) String status,@RequestParam(required=false) Long farmId){return ApiResponse.success(query.devicePage(authorization,pageNum,pageSize,keyword,deviceType,status,farmId));}
}
