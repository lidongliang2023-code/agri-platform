package com.agri.iot.controller;

import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.iot.dto.AlertHandleDTO;
import com.agri.iot.dto.AlertRecordPageDTO;
import com.agri.iot.service.IAlertRecordService;
import com.agri.iot.vo.AlertRecordVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/iot/alert")
@RequiredArgsConstructor
public class AlertController {

    private final IAlertRecordService alertRecordService;

    @GetMapping("/page")
    public ApiResponse<PageResult<AlertRecordVO>> page(AlertRecordPageDTO dto) {
        return ApiResponse.success(alertRecordService.page(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<AlertRecordVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(alertRecordService.getById(id));
    }

    @PutMapping("/{id}/handle")
    public ApiResponse<Void> handle(@PathVariable Long id, @RequestBody @Valid AlertHandleDTO dto) {
        alertRecordService.handle(id, dto);
        return ApiResponse.success();
    }

    @PutMapping("/batch/handle")
    public ApiResponse<Void> batchHandle(@RequestBody List<Long> ids, @RequestParam String result) {
        alertRecordService.batchHandle(ids, result);
        return ApiResponse.success();
    }

    @GetMapping("/unhandled/count")
    public ApiResponse<Long> getUnhandledCount() {
        return ApiResponse.success(alertRecordService.getUnhandledCount());
    }

    @GetMapping("/recent")
    public ApiResponse<List<AlertRecordVO>> getRecentAlerts(@RequestParam(defaultValue = "10") Integer limit) {
        return ApiResponse.success(alertRecordService.getRecentAlerts(limit));
    }
}
