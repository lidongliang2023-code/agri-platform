package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.IReportAnalyticsService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.DimensionPointVO;
import com.agri.production.vo.MetricTrendPointVO;
import com.agri.production.vo.ReportSubscriptionVO;
import com.agri.production.vo.ReportVO;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 用户端：数据分析与报表（{@code /api/v1/production/analytics}）。
 *
 * <p>页面用到的路径：看板（/dashboard）、维度分析（/dimension）、指标趋势（/trend）、
 * 报表列表与生成（/reports）、导出（/reports/{id}/export）、下载（/reports/{id}/file）、
 * 订阅（/reports/subscribe、/reports/subscriptions）。</p>
 *
 * <p>为什么不并进已有的 {@code AnalyticsController}：那个类是在途文件（同域好几个段都在改它），
 * 本段按"新控制器 + 新服务"落地，避免与并行改动互相踩。</p>
 *
 * <p><b>下载端点是唯一不需要平台令牌的入口</b>：页面用 window.open 打开导出文件，带不了请求头，
 * 因此改用报表自带的下载令牌（见 IReportAnalyticsService#download 的说明）。</p>
 */
@RestController
@RequestMapping("/api/v1/production/analytics")
public class AnalyticsReportController {

    private final IReportAnalyticsService analyticsService;
    private final FarmIdResolver farmIdResolver;

    public AnalyticsReportController(IReportAnalyticsService analyticsService, FarmIdResolver farmIdResolver) {
        this.analyticsService = analyticsService;
        this.farmIdResolver = farmIdResolver;
    }

    /* ==================== 看板 / 维度 / 趋势 ==================== */

    /** 看板指标（扁平 Map，键与前端 buildOverview 的候选键一致）。 */
    @GetMapping("/dashboard")
    public ApiResponse<Map<String, Object>> dashboard(
            @RequestParam(required = false) String farmId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(analyticsService.dashboard(tenantId,
                farmIdResolver.resolveFilter(farmId, tenantId), startDate, endDate));
    }

    /** 多维度分析（crop 按作物 / plot 按地块 / month 按时间）。 */
    @GetMapping("/dimension")
    public ApiResponse<List<DimensionPointVO>> dimension(
            @RequestParam(required = false) String dimension,
            @RequestParam(required = false) String farmId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(analyticsService.dimension(tenantId,
                farmIdResolver.resolveFilter(farmId, tenantId), dimension, startDate, endDate));
    }

    /** 指标趋势（YIELD 采收量 / PASS_RATE 检测合格率）。 */
    @GetMapping("/trend")
    public ApiResponse<List<MetricTrendPointVO>> trend(
            @RequestParam(required = false) String metricCode,
            @RequestParam(required = false) String farmId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(analyticsService.trend(tenantId,
                farmIdResolver.resolveFilter(farmId, tenantId), metricCode, startDate, endDate));
    }

    /* ==================== 报表 ==================== */

    /** 报表分页（period 参数按页面口径做关键字匹配：报表名或周期标签）。 */
    @GetMapping("/reports")
    public ApiResponse<PageResult<ReportVO>> reports(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) Integer reportType,
            @RequestParam(required = false) String period) {
        return ApiResponse.success(analyticsService.pageReports(
                TenantContextService.currentTenantId(),
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), reportType, period));
    }

    /** 生成报表（即时聚合落库快照，返回报表行含 reportId）。 */
    @PostMapping("/reports")
    public ApiResponse<ReportVO> generateReport(@RequestBody(required = false) Map<String, Object> body) {
        String tenantId = TenantContextService.currentTenantId();
        Map<String, Object> payload = body == null ? Map.of() : body;
        return ApiResponse.success(analyticsService.generate(tenantId,
                farmIdResolver.resolveFilter(str(payload.get("farmId")), tenantId),
                intOrNull(payload.get("reportType"), "报表类型"),
                str(payload.get("period")),
                str(payload.get("generatedBy"))));
    }

    /** 删除报表（页面以返回值是否为 true 判定"确实删掉了"）。 */
    @DeleteMapping("/reports/{reportId}")
    public ApiResponse<Boolean> deleteReport(@PathVariable String reportId) {
        analyticsService.deleteReport(TenantContextService.currentTenantId(), reportId);
        return ApiResponse.success(true);
    }

    /** 导出报表：落 CSV 并返回可访问地址。 */
    @GetMapping("/reports/{reportId}/export")
    public ApiResponse<Map<String, Object>> exportReport(@PathVariable String reportId) {
        return ApiResponse.success(analyticsService.export(TenantContextService.currentTenantId(), reportId));
    }

    /**
     * 下载报表文件（免令牌头，靠报表自带的下载令牌校验）。
     *
     * @param reportId 报表编号
     * @param key      下载令牌
     */
    @GetMapping("/reports/{reportId}/file")
    public ResponseEntity<byte[]> downloadReport(@PathVariable String reportId,
                                                @RequestParam(required = false) String key) {
        IReportAnalyticsService.ReportFile file = analyticsService.download(reportId, key);
        String encoded = URLEncoder.encode(file.fileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(file.content());
    }

    /* ==================== 订阅 ==================== */

    /** 新增订阅（返回体带 delivery = not-configured：本部署不推送）。 */
    @PostMapping("/reports/subscribe")
    public ApiResponse<ReportSubscriptionVO> subscribe(@RequestBody(required = false) Map<String, Object> body) {
        String tenantId = TenantContextService.currentTenantId();
        Map<String, Object> payload = body == null ? Map.of() : body;
        return ApiResponse.success(analyticsService.subscribe(tenantId,
                farmIdResolver.resolveFilter(str(payload.get("farmId")), tenantId),
                new IReportAnalyticsService.SubscriptionPayload(
                        intOrNull(payload.get("reportType"), "报表类型"),
                        str(payload.get("period")),
                        intList(payload.get("channels")),
                        strList(payload.get("receivers")),
                        intOrNull(payload.get("status"), "订阅状态"))));
    }

    /** 订阅列表。 */
    @GetMapping("/reports/subscriptions")
    public ApiResponse<List<ReportSubscriptionVO>> subscriptions() {
        return ApiResponse.success(analyticsService.listSubscriptions(TenantContextService.currentTenantId()));
    }

    /** 取消订阅（页面以返回值判定同步结果）。 */
    @DeleteMapping("/reports/subscriptions/{subscribeId}")
    public ApiResponse<Boolean> unsubscribe(@PathVariable String subscribeId) {
        analyticsService.unsubscribe(TenantContextService.currentTenantId(), subscribeId);
        return ApiResponse.success(true);
    }

    /* ==================== 参数小工具 ==================== */

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static Integer intOrNull(Object value, String field) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return Integer.valueOf(text);
        } catch (NumberFormatException e) {
            throw new BusinessException(400, field + "应为整数：" + text);
        }
    }

    private static List<Integer> intList(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof List<?> list) {
            List<Integer> result = new ArrayList<>();
            for (Object item : list) {
                Integer parsed = intOrNull(item, "接收渠道");
                if (parsed != null) {
                    result.add(parsed);
                }
            }
            return result;
        }
        Integer single = intOrNull(value, "接收渠道");
        return single == null ? null : List.of(single);
    }

    private static List<String> strList(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof List<?> list) {
            List<String> result = new ArrayList<>();
            for (Object item : list) {
                String text = str(item);
                if (text != null) {
                    result.add(text);
                }
            }
            return result;
        }
        String single = str(value);
        return single == null ? null : List.of(single);
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
