package com.agri.produce.internal.device;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
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

import java.util.List;

/**
 * 设备档案（管理侧）。
 * 路径已按 PRD 5.1 迁移至 /api/v1/production/devices。
 */
@RestController
@RequestMapping("/api/v1/production/devices")
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceService deviceService;

    @Data
    public static class CreateDeviceRequest {
        @NotBlank(message = "设备编号不能为空")
        private String deviceNo;
        @NotBlank(message = "设备名称不能为空")
        private String name;
        private String type;
        private Long plotId;
    }

    @GetMapping
    public ApiResponse<PageResult<DeviceEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                      @RequestParam(defaultValue = "10") long size,
                                                      @RequestParam(required = false) String type,
                                                      @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(deviceService.page(page, size, type, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<DeviceEntity> detail(@PathVariable Long id) {
        return ApiResponse.ok(deviceService.detail(id));
    }

    @PostMapping
    public ApiResponse<Long> create(@Valid @RequestBody CreateDeviceRequest req) {
        return ApiResponse.ok(deviceService.create(req.getDeviceNo(), req.getName(),
                req.getType(), req.getPlotId()).getId());
    }

    @PutMapping("/{id}")
    public ApiResponse<DeviceEntity> update(@PathVariable Long id, @RequestBody DeviceEntity device) {
        return ApiResponse.ok(deviceService.update(id, device));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        deviceService.delete(id);
        return ApiResponse.ok();
    }

    /** 在线状态变更 */
    @PostMapping("/{id}/online")
    public ApiResponse<DeviceEntity> online(@PathVariable Long id,
                                            @RequestParam(defaultValue = "true") boolean online) {
        return ApiResponse.ok(deviceService.online(id, online));
    }

    /** 地块下设备清单 */
    @GetMapping("/by-plot")
    public ApiResponse<List<DeviceEntity>> byPlot(@RequestParam Long plotId) {
        return ApiResponse.ok(deviceService.listByPlot(plotId));
    }
}
