
package com.agri.iot.controller;

import com.agri.common.entity.ApiResponse;
import com.agri.iot.dto.DeviceGroupSaveDTO;
import com.agri.iot.dto.DeviceGroupUpdateDTO;
import com.agri.iot.service.IDeviceGroupService;
import com.agri.iot.vo.DeviceGroupVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/iot/group")
@RequiredArgsConstructor
public class DeviceGroupController {

    private final IDeviceGroupService deviceGroupService;

    @GetMapping("/list")
    public ApiResponse<List<DeviceGroupVO>> list() {
        return ApiResponse.success(deviceGroupService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<DeviceGroupVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(deviceGroupService.getById(id));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody @Valid DeviceGroupSaveDTO dto) {
        deviceGroupService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody DeviceGroupUpdateDTO dto) {
        deviceGroupService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        deviceGroupService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{groupId}/devices")
    public ApiResponse<Void> addDevices(@PathVariable Long groupId, @RequestBody List<Long> deviceIds) {
        deviceGroupService.addDevices(groupId, deviceIds);
        return ApiResponse.success();
    }

    @DeleteMapping("/{groupId}/devices")
    public ApiResponse<Void> removeDevices(@PathVariable Long groupId, @RequestBody List<Long> deviceIds) {
        deviceGroupService.removeDevices(groupId, deviceIds);
        return ApiResponse.success();
    }

    @PostMapping("/{groupId}/control")
    public ApiResponse<Void> batchControl(@PathVariable Long groupId, @RequestBody String command) {
        deviceGroupService.batchControl(groupId, command);
        return ApiResponse.success();
    }
}
