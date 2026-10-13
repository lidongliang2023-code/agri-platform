package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 报表（运营端）。
 *
 * <p>数字全部来自真实表，口径见 {@link ReportService}：成交排除已取消订单，
 * 不做环比/同比（库里没有足够历史，硬算出来的环比没有意义）。</p>
 */
@RestController
@RequestMapping("/api/trade/admin/report")
@RequiredArgsConstructor
public class AdminReportController {

    private final ReportService reportService;

    @Operation(summary = "交易报表（按日/周/月）")
    @GetMapping("/trade")
    public ApiResponse<List<Map<String, Object>>> tradeReport(
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam(defaultValue = "day") String granularity) {
        return ApiResponse.success(reportService.tradeReport(
                LocalDate.parse(startDate), LocalDate.parse(endDate), granularity));
    }

    @Operation(summary = "品类报表")
    @GetMapping("/category")
    public ApiResponse<List<Map<String, Object>>> categoryReport(
            @RequestParam String startDate,
            @RequestParam String endDate) {
        return ApiResponse.success(reportService.categoryReport(
                LocalDate.parse(startDate), LocalDate.parse(endDate)));
    }

    /** 导出 CSV（带 BOM，Excel 直接打开不乱码）。 */
    @Operation(summary = "导出报表 CSV")
    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam(defaultValue = "day") String granularity,
            @RequestParam(defaultValue = "trade") String type) {
        String csv = reportService.exportCsv(LocalDate.parse(startDate), LocalDate.parse(endDate),
                granularity, type);
        String fileName = ("report-" + type + "-" + startDate + "_" + endDate + ".csv");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }
}
