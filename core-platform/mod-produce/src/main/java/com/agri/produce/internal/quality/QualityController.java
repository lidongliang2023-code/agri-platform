package com.agri.produce.internal.quality;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
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

/**
 * 质量检测与检测机构（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/quality")
@RequiredArgsConstructor
public class QualityController {

    private final InspectionService inspectionService;
    private final QualityLabService qualityLabService;
    private final QualityService qualityService;

    /** 登记质检报告（旧版台账 prod_quality_report，保留兼容） */
    @PostMapping("/reports")
    public ApiResponse<QualityReportEntity> report(@Valid @RequestBody ReportRequest req) {
        return ApiResponse.ok(qualityService.report(req.getBatchId(), req.getItem(), req.isPass()));
    }

    /** 批次的质检报告列表 */
    @GetMapping("/reports")
    public ApiResponse<List<QualityReportEntity>> reports(@RequestParam Long batchId) {
        return ApiResponse.ok(qualityService.listByBatch(batchId));
    }

    @GetMapping("/inspections")
    public ApiResponse<PageResult<InspectionEntity>> pageInspection(@RequestParam(defaultValue = "1") long page,
                                                                    @RequestParam(defaultValue = "10") long size,
                                                                    @RequestParam(required = false) String keyword,
                                                                    @RequestParam(required = false) String status) {
        return ApiResponse.ok(inspectionService.page(page, size, keyword, status));
    }

    @GetMapping("/inspections/{id}")
    public ApiResponse<InspectionEntity> detailInspection(@PathVariable String id) {
        return ApiResponse.ok(inspectionService.detail(id));
    }

    @PostMapping("/inspections")
    public ApiResponse<String> createInspection(@RequestBody InspectionEntity entity) {
        return ApiResponse.ok(inspectionService.create(entity).getInspectionId());
    }

    @PutMapping("/inspections/{id}")
    public ApiResponse<InspectionEntity> updateInspection(@PathVariable String id, @RequestBody InspectionEntity entity) {
        return ApiResponse.ok(inspectionService.update(id, entity));
    }

    @DeleteMapping("/inspections/{id}")
    public ApiResponse<Void> deleteInspection(@PathVariable String id) {
        inspectionService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/labs")
    public ApiResponse<PageResult<QualityLabEntity>> pageQualityLab(@RequestParam(defaultValue = "1") long page,
                                                                    @RequestParam(defaultValue = "10") long size,
                                                                    @RequestParam(required = false) String keyword,
                                                                    @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(qualityLabService.page(page, size, keyword, status));
    }

    @GetMapping("/labs/{id}")
    public ApiResponse<QualityLabEntity> detailQualityLab(@PathVariable String id) {
        return ApiResponse.ok(qualityLabService.detail(id));
    }

    @PostMapping("/labs")
    public ApiResponse<String> createQualityLab(@RequestBody QualityLabEntity entity) {
        return ApiResponse.ok(qualityLabService.create(entity).getLabId());
    }

    @PutMapping("/labs/{id}")
    public ApiResponse<QualityLabEntity> updateQualityLab(@PathVariable String id, @RequestBody QualityLabEntity entity) {
        return ApiResponse.ok(qualityLabService.update(id, entity));
    }

    @DeleteMapping("/labs/{id}")
    public ApiResponse<Void> deleteQualityLab(@PathVariable String id) {
        qualityLabService.delete(id);
        return ApiResponse.ok();
    }

    /** 提交检测结论 */
    @PostMapping("/inspections/{inspectionId}/result")
    public ApiResponse<InspectionEntity> submitResult(@PathVariable String inspectionId,
                                                      @RequestParam String result,
                                                      @RequestParam(required = false) String reportUrl) {
        return ApiResponse.ok(inspectionService.submitResult(inspectionId, result, reportUrl));
    }

    /** 批次检测记录 */
    @GetMapping("/inspections/by-batch")
    public ApiResponse<List<InspectionEntity>> inspectionsByBatch(@RequestParam String batchId) {
        return ApiResponse.ok(inspectionService.listByBatch(batchId));
    }

    /** 合作中检测机构 */
    @GetMapping("/labs/active")
    public ApiResponse<List<QualityLabEntity>> activeLabs() {
        return ApiResponse.ok(qualityLabService.listActive());
    }

    /** 质检登记请求体 */
    @Data
    public static class ReportRequest {
        @NotNull(message = "批次不能为空")
        private Long batchId;
        @NotBlank(message = "检测项不能为空")
        private String item;
        private boolean pass;
    }

    /** 检测项明细 */
    @GetMapping("/inspections/{id}/items")
    public ApiResponse<Map<String, Object>> inspectionItems(@PathVariable String id) {
        return ApiResponse.ok(inspectionService.items(id));
    }

    /** 分级统计 */
    @GetMapping("/grading")
    public ApiResponse<Map<String, Object>> grading() {
        return ApiResponse.ok(inspectionService.grading());
    }
}
