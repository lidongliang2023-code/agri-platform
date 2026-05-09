package com.agri.iot.controller;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.iot.dto.DevicePageDTO;
import com.agri.iot.dto.DeviceSaveDTO;
import com.agri.iot.dto.DeviceUpdateDTO;
import com.agri.iot.service.IDeviceService;
import com.agri.iot.vo.DeviceVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/iot/device")
@RequiredArgsConstructor
public class DeviceController {

    private final IDeviceService deviceService;

    @GetMapping("/page")
    public ApiResponse<PageResult<DeviceVO>> page(DevicePageDTO dto) {
        return ApiResponse.success(deviceService.page(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<DeviceVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(deviceService.getById(id));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody @Valid DeviceSaveDTO dto) {
        deviceService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody @Valid DeviceUpdateDTO dto) {
        deviceService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        deviceService.delete(id);
        return ApiResponse.success();
    }
}