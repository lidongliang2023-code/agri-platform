package com.agri.monitor.controller.iot;

import com.agri.monitor.dto.FirmwarePageDTO;
import com.agri.monitor.dto.FirmwareSaveDTO;
import com.agri.monitor.dto.FirmwareVO;
import com.agri.monitor.result.Result;
import com.agri.monitor.service.IFirmwareService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/iot/firmware")
@RequiredArgsConstructor
@Tag(name = "固件管理")
public class FirmwareController {

    private final IFirmwareService firmwareService;

    @GetMapping("/page")
    @Operation(summary = "固件分页列表")
    public Result<Page<FirmwareVO>> page(FirmwarePageDTO dto) {
        return firmwareService.page(dto);
    }

    @GetMapping("/{id}")
    @Operation(summary = "固件详情")
    public Result<FirmwareVO> detail(@PathVariable Long id) {
        return firmwareService.detail(id);
    }

    @PostMapping
    @Operation(summary = "添加固件")
    public Result<Void> save(@RequestBody FirmwareSaveDTO dto) {
        return firmwareService.save(dto);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新固件")
    public Result<Void> update(@PathVariable Long id, @RequestBody FirmwareSaveDTO dto) {
        return firmwareService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除固件")
    public Result<Void> delete(@PathVariable Long id) {
        return firmwareService.delete(id);
    }

    @PostMapping("/{id}/activate")
    @Operation(summary = "激活固件")
    public Result<Void> activate(@PathVariable Long id) {
        return firmwareService.activate(id);
    }
}
