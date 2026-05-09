package com.agri.monitor.controller.iot;

import com.agri.monitor.dto.OtaTaskPageDTO;
import com.agri.monitor.dto.OtaTaskSaveDTO;
import com.agri.monitor.dto.OtaTaskVO;
import com.agri.monitor.result.Result;
import com.agri.monitor.service.IOtaTaskService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/iot/ota")
@RequiredArgsConstructor
@Tag(name = "OTA升级")
public class OtaTaskController {

    private final IOtaTaskService otaTaskService;

    @GetMapping("/page")
    @Operation(summary = "OTA任务分页列表")
    public Result<Page<OtaTaskVO>> page(OtaTaskPageDTO dto) {
        return otaTaskService.page(dto);
    }

    @GetMapping("/{id}")
    @Operation(summary = "OTA任务详情")
    public Result<OtaTaskVO> detail(@PathVariable Long id) {
        return otaTaskService.detail(id);
    }

    @PostMapping
    @Operation(summary = "创建OTA任务")
    public Result<Void> save(@RequestBody OtaTaskSaveDTO dto) {
        return otaTaskService.save(dto);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新OTA任务")
    public Result<Void> update(@PathVariable Long id, @RequestBody OtaTaskSaveDTO dto) {
        return otaTaskService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除OTA任务")
    public Result<Void> delete(@PathVariable Long id) {
        return otaTaskService.delete(id);
    }

    @PostMapping("/{id}/execute")
    @Operation(summary = "执行OTA任务")
    public Result<Void> execute(@PathVariable Long id) {
        return otaTaskService.execute(id);
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "取消OTA任务")
    public Result<Void> cancel(@PathVariable Long id) {
        return otaTaskService.cancel(id);
    }
}
