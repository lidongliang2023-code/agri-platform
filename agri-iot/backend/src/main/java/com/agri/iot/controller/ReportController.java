
package com.agri.iot.controller;

import com.agri.common.entity.ApiResponse;
import com.agri.iot.dto.ReportSaveDTO;
import com.agri.iot.service.IReportService;
import com.agri.iot.vo.ReportVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/iot/report")
@RequiredArgsConstructor
public class ReportController {

    private final IReportService reportService;

    @GetMapping("/list")
    public ApiResponse<List<ReportVO>> list() {
        return ApiResponse.success(reportService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<ReportVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(reportService.getById(id));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody @Valid ReportSaveDTO dto) {
        reportService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody ReportSaveDTO dto) {
        reportService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        reportService.delete(id);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/data")
    public ApiResponse<Object> getData(
            @PathVariable Long id,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        return ApiResponse.success(reportService.getData(id, startTime, endTime));
    }

    @PostMapping("/{id}/export")
    public ApiResponse<Void> export(@PathVariable Long id) {
        reportService.export(id);
        return ApiResponse.success();
    }
}
