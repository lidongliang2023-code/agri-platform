package com.agri.produce.internal.admin;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
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
 * 运营端：监管报表任务。
 */
@RestController
@RequestMapping("/api/v1/production/admin/reports")
@RequiredArgsConstructor
public class AdminReportController {

    private final ReportTaskService reportTaskService;

    @GetMapping
    public ApiResponse<PageResult<ReportTaskEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                          @RequestParam(defaultValue = "10") long size,
                                                          @RequestParam(required = false) String keyword,
                                                          @RequestParam(required = false) String status) {
        return ApiResponse.ok(reportTaskService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<ReportTaskEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(reportTaskService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody ReportTaskEntity entity) {
        return ApiResponse.ok(reportTaskService.create(entity).getReportId());
    }

    @PutMapping("/{id}")
    public ApiResponse<ReportTaskEntity> update(@PathVariable String id, @RequestBody ReportTaskEntity entity) {
        return ApiResponse.ok(reportTaskService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        reportTaskService.delete(id);
        return ApiResponse.ok();
    }

    /** 触发生成 */
    @PostMapping("/{reportId}/generate")
    public ApiResponse<ReportTaskEntity> generate(@PathVariable String reportId) {
        return ApiResponse.ok(reportTaskService.generate(reportId));
    }

    /** 按类型查询 */
    @GetMapping("/by-type")
    public ApiResponse<List<ReportTaskEntity>> byType(@RequestParam String reportType) {
        return ApiResponse.ok(reportTaskService.listByType(reportType));
    }

    /** 生产（监管）报表 */
    @GetMapping("/production")
    public ApiResponse<List<ReportTaskEntity>> production() {
        return ApiResponse.ok(reportTaskService.listByType("GOV"));
    }

    /** 质量报表 */
    @GetMapping("/quality")
    public ApiResponse<List<ReportTaskEntity>> quality() {
        return ApiResponse.ok(reportTaskService.listByType("QUALITY"));
    }
}
