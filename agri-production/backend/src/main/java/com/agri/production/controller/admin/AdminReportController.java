package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.ReportTask;
import com.agri.production.service.IAdminReportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：统计报表（{@code /api/v1/production/admin/reports}）。
 *
 * <p>按页面契约 {@code api/admin/reports.ts} 实现页面真的会调的五条：
 * 台账分页 / 新建 / 生产（GOV）报表 / 质量（QUALITY）报表 / 报表中心统计。</p>
 *
 * <p><b>{@code /stat} 在平台侧是被吞掉的</b>：core 的 AdminReportController 没有这个端点，
 * 请求会被 {@code @GetMapping("/{id}")} 接走当作"报表编号=stat"去查，必然 404 ——
 * 页面对此写了明确的降级提示。这里实现它，页面那三张卡片才有真数。</p>
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
            @RequestParam(required = false) String status) {
        return ApiResponse.success(adminReportService.pageReports(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), keyword, status));
    }

    /** 新建报表任务（返回报表编号）。 */
    @PostMapping
    public ApiResponse<String> create(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.success(adminReportService.createReport(payload));
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
