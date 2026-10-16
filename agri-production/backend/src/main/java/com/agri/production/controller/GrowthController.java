package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.IGrowthService;
import com.agri.production.service.ISensorPivotService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.EnvTrendVO;
import com.agri.production.vo.EnvironmentDataVO;
import com.agri.production.vo.GrowthRecordVO;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 用户端：生长监测（{@code /api/v1/production/growth}）。
 *
 * <p>页面用到的路径：生长记录列表/新增/编辑/删除、环境数据分页、环境趋势、按地块取记录（长势对比）、
 * 病虫害记录、地块生长总览。</p>
 *
 * <p><b>环境三条端点为什么直接调 {@link ISensorPivotService}</b>：长表透视为宽表这件事
 * 不是"生长记录"的业务，iot 段的读数端点要用同一套（见该接口注释）。这里显式注入，
 * 不做一个只转发的中间层 —— 中间层会让人以为两处口径可以各自演化。</p>
 *
 * <p><b>{@code GET /growth/environment/trend}（原始窄表行）刻意未实现</b>：它在前端标了
 * {@code @deprecated}，没有任何页面调用（要曲线请用 {@code /environment/history}）。
 * 未实现时网关按 404 回退到平台侧，属预期；将来若确有调用方，再按 iot 段的读数端点口径补。</p>
 */
@RestController
@RequestMapping("/api/v1/production/growth")
public class GrowthController {

    private final IGrowthService growthService;
    private final ISensorPivotService pivotService;
    private final FarmIdResolver farmIdResolver;

    public GrowthController(IGrowthService growthService, ISensorPivotService pivotService,
                            FarmIdResolver farmIdResolver) {
        this.growthService = growthService;
        this.pivotService = pivotService;
        this.farmIdResolver = farmIdResolver;
    }

    /* ==================== 生长记录 ==================== */

    /** 生长记录分页。 */
    @GetMapping("/records")
    public ApiResponse<PageResult<GrowthRecordVO>> records(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String farmId,
            @RequestParam(required = false) String plotId,
            @RequestParam(required = false) String planId,
            @RequestParam(required = false) String growthStage,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(growthService.page(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), tenantId,
                // 农场标识换算：页面传的是平台侧标识（DEMO-FARM-xxx），换不出来会 400 而不是静默全量
                farmIdResolver.resolveFilter(farmId, tenantId),
                plotId, planId, growthStage, startDate, endDate));
    }

    /** 生长记录详情。 */
    @GetMapping("/records/{recordId}")
    public ApiResponse<GrowthRecordVO> recordDetail(@PathVariable String recordId) {
        return ApiResponse.success(growthService.detail(TenantContextService.currentTenantId(), recordId));
    }

    /** 新增生长记录，返回记录编号。 */
    @PostMapping("/records")
    public ApiResponse<String> createRecord(@RequestBody(required = false) Map<String, Object> body) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(growthService.create(tenantId, payloadOf(body)));
    }

    /** 编辑生长记录。 */
    @PutMapping("/records/{recordId}")
    public ApiResponse<GrowthRecordVO> updateRecord(@PathVariable String recordId,
                                                   @RequestBody(required = false) Map<String, Object> body) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(growthService.update(tenantId, recordId, payloadOf(body)));
    }

    /**
     * 删除生长记录（逻辑删除）。
     *
     * <p>页面列表上就有"删除"按钮：不实现的话请求会 404 回退到平台侧，删的是平台库里的另一张表 ——
     * 页面提示"已删除"而本服务的行还在，这比报错难发现得多。</p>
     */
    @DeleteMapping("/records/{recordId}")
    public ApiResponse<Void> deleteRecord(@PathVariable String recordId) {
        growthService.delete(TenantContextService.currentTenantId(), recordId);
        return ApiResponse.success();
    }

    /** 某地块的全部记录（页面「长势对比」，返回纯数组）。 */
    @GetMapping("/by-plot")
    public ApiResponse<List<GrowthRecordVO>> byPlot(@RequestParam(required = false) String plotId) {
        return ApiResponse.success(growthService.byPlot(TenantContextService.currentTenantId(), plotId));
    }

    /** 病虫害记录（返回纯数组；level 为等级下限，0 无 / 1 轻 / 2 中 / 3 重）。 */
    @GetMapping("/pest")
    public ApiResponse<List<GrowthRecordVO>> pest(@RequestParam(defaultValue = "1") int level) {
        return ApiResponse.success(growthService.pest(TenantContextService.currentTenantId(), level));
    }

    /** 地块生长总览（返回 Map）。 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview(@RequestParam(required = false) String plotId) {
        return ApiResponse.success(growthService.overview(TenantContextService.currentTenantId(), plotId));
    }

    /* ==================== 环境数据 ==================== */

    /** 环境数据（宽表，分页；由传感器长表透视而来，缺采指标为 null）。 */
    @GetMapping("/environment")
    public ApiResponse<PageResult<EnvironmentDataVO>> environment(
            @RequestParam(required = false) String plotId,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(pivotService.environmentPage(tenantId, plotId, deviceId, startDate, endDate,
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10)));
    }

    /** 环境趋势（按天聚合的多指标曲线：dates / series / temperatures / stats）。 */
    @GetMapping("/environment/history")
    public ApiResponse<EnvTrendVO> environmentHistory(
            @RequestParam(required = false) String plotId,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String metrics,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        if (plotId == null || plotId.isBlank()) {
            // 平台侧该端点的 plotId 必填；缺参时给明确的 400，而不是把"按地块看曲线"变成"全租户曲线"
            throw new BusinessException(400, "缺少请求参数: plotId");
        }
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(pivotService.history(tenantId, plotId, deviceId, metrics, startDate, endDate));
    }

    /* ==================== 参数小工具 ==================== */

    /**
     * 请求体 → 服务入参。
     *
     * <p>{@code farmId} 的换算放在服务层（那里才拿得到租户），这里原样透传字符串。</p>
     */
    private static IGrowthService.GrowthPayload payloadOf(Map<String, Object> body) {
        if (body == null) {
            return null;
        }
        return new IGrowthService.GrowthPayload(
                str(body.get("plotId")),
                str(body.get("plotName")),
                str(body.get("farmId")),
                str(body.get("planId")),
                str(body.get("cropId")),
                str(body.get("cropName")),
                str(body.get("growthStage")),
                decimal(body.get("plantHeight"), "株高"),
                intOrNull(body.get("leafCount"), "叶片数"),
                decimal(body.get("leafAreaIndex"), "叶面积指数"),
                intOrNull(body.get("growthLevel"), "长势评级"),
                intOrNull(body.get("pestLevel"), "病虫害等级"),
                str(body.get("pestInfo")),
                str(body.get("weather")),
                str(body.get("recorderId")),
                str(body.get("recorderName")),
                str(body.get("recordDate")),
                strList(body.get("photoUrls")),
                str(body.get("photos")),
                str(body.get("remark")),
                intOrNull(body.get("status"), "状态"));
    }

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

    private static BigDecimal decimal(Object value, String field) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException e) {
            throw new BusinessException(400, field + "应为数字：" + text);
        }
    }

    @SuppressWarnings("unchecked")
    private static List<String> strList(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof List<?> list) {
            List<String> result = new ArrayList<>();
            for (Object item : list) {
                if (item != null && !String.valueOf(item).isBlank()) {
                    result.add(String.valueOf(item).trim());
                }
            }
            return result;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        // 页面理论上只发数组；字符串时按分隔符兜底，免得整串被当成一个地址
        List<String> result = new ArrayList<>();
        for (String part : text.split("[,，\\s]+")) {
            if (!part.isBlank()) {
                result.add(part.trim());
            }
        }
        return result;
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
