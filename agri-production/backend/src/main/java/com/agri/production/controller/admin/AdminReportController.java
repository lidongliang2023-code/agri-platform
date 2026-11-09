package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.ReportTask;
import com.agri.production.service.IAdminReportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * 运营端：统计报表（{@code /api/v1/production/admin/reports}）。
 */
@RestController
@RequestMapping("/api/v1/production/admin/reports")
public class AdminReportController {

    private final IAdminReportService adminReportService;

    public AdminReportController(IAdminReportService adminReportService) {
        this.adminReportService = adminReportService;
    }

    /** 报表台账分页。 */
    @GetMapping
    public ApiResponse<PageResult<ReportTask>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String reportType,
            @RequestParam(required = false) Long farmId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        return ApiResponse.success(adminReportService.pageReports(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                keyword, status, reportType, farmId, startDate, endDate));
    }

    @GetMapping("/detail/{code}")
    public ApiResponse<ReportTask> detail(@PathVariable String code) {
        return ApiResponse.success(adminReportService.getReport(code));
    }

    /** 新建报表任务（返回报表编号）。 */
    @PostMapping
    public ApiResponse<String> create(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.success(adminReportService.createReport(payload));
    }

    /** 按任务生成真实报表快照文件（落盘并回填下载地址）。 */
    @PostMapping("/{code}/generate")
    public ApiResponse<ReportTask> generate(@PathVariable String code) {
        return ApiResponse.success(adminReportService.generateReportFile(code));
    }

    /** 下载报表快照文件。 */
    @GetMapping("/{code}/file")
    public ResponseEntity<byte[]> download(@PathVariable String code) {
        IAdminReportService.ReportFile file = adminReportService.downloadReportFile(code);
        String encoded = URLEncoder.encode(file.fileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(file.content());
    }

    /** 生产（监管）报表：类型 GOV。 */
    @GetMapping("/production")
    public ApiResponse<List<ReportTask>> production() {
        return ApiResponse.success(adminReportService.listByType("GOV"));
    }

    /** 质量报表：类型 QUALITY。 */
    @GetMapping("/quality")
    public ApiResponse<List<ReportTask>> quality() {
        return ApiResponse.success(adminReportService.listByType("QUALITY"));
    }

    /** 报表中心统计。 */
    @GetMapping("/stat")
    public ApiResponse<Map<String, Object>> stat() {
        return ApiResponse.success(adminReportService.reportStat());
    }

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }
}
