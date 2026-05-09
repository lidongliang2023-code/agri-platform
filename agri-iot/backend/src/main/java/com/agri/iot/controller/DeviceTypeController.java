package com.agri.iot.controller;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.iot.dto.DeviceTypePageDTO;
import com.agri.iot.dto.DeviceTypeSaveDTO;
import com.agri.iot.dto.DeviceTypeUpdateDTO;
import com.agri.iot.service.IDeviceTypeService;
import com.agri.iot.vo.DeviceTypeVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/iot/device-type")
@RequiredArgsConstructor
public class DeviceTypeController {

    private final IDeviceTypeService deviceTypeService;

    @GetMapping("/page")
    public ApiResponse<PageResult<DeviceTypeVO>> page(DeviceTypePageDTO dto) {
        return ApiResponse.success(deviceTypeService.page(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<DeviceTypeVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(deviceTypeService.getById(id));
    }

    @GetMapping("/list")
    public ApiResponse<List<DeviceTypeVO>> listAll() {
        return ApiResponse.success(deviceTypeService.listAll());
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody @Valid DeviceTypeSaveDTO dto) {
        deviceTypeService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody @Valid DeviceTypeUpdateDTO dto) {
        deviceTypeService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        deviceTypeService.delete(id);
        return ApiResponse.success();
    }
}