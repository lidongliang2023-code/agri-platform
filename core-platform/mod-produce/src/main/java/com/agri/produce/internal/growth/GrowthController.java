package com.agri.produce.internal.growth;

import com.agri.produce.internal.common.DateParams;
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
import com.agri.produce.internal.iot.EnvTrendVO;
import com.agri.produce.internal.iot.IotReadingEntity;
import com.agri.produce.internal.iot.IotReadingService;

/**
 * 生长监测记录（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/growth")
@RequiredArgsConstructor
public class GrowthController {

    private final GrowthRecordService growthRecordService;
    private final IotReadingService iotReadingService;

    @GetMapping
    public ApiResponse<PageResult<GrowthRecordEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                            @RequestParam(defaultValue = "10") long size,
                                                            @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(growthRecordService.page(page, size, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<GrowthRecordEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(growthRecordService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody GrowthRecordEntity entity) {
        return ApiResponse.ok(growthRecordService.create(entity).getRecordId());
    }

    @PutMapping("/{id}")
    public ApiResponse<GrowthRecordEntity> update(@PathVariable String id, @RequestBody GrowthRecordEntity entity) {
        return ApiResponse.ok(growthRecordService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        growthRecordService.delete(id);
        return ApiResponse.ok();
    }

    /** 地块生长曲线 */
    @GetMapping("/by-plot")
    public ApiResponse<List<GrowthRecordEntity>> byPlot(@RequestParam String plotId) {
        return ApiResponse.ok(growthRecordService.listByPlot(plotId));
    }

    /** 病虫害记录 */
    @GetMapping("/pest")
    public ApiResponse<List<GrowthRecordEntity>> pest(@RequestParam(defaultValue = "1") int level) {
        return ApiResponse.ok(growthRecordService.listPest(level));
    }

    /** 生长记录列表 */
    @GetMapping("/records")
    public ApiResponse<PageResult<GrowthRecordEntity>> records(@RequestParam(defaultValue = "1") long page,
                                                               @RequestParam(defaultValue = "10") long size,
                                                               @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(growthRecordService.page(page, size, status));
    }

    /**
     * 环境数据（<b>宽表</b>，分页）。
     *
     * <p>库内 {@code prod_iot_reading} 是窄表（一行一个 metric+value），而前端
     * {@code EnvironmentData} 是宽表（一行含温度/湿度/光照等列），此前直接返回窄表原始行
     * 导致两处环境页渲染为空——这是真 bug。此处在服务端做「设备+地块+采集时刻」透视后再返回，
     * <b>缺采指标留 null，不补 0</b>。需要原始窄表行的场景请改用 {@code /environment/raw}。</p>
     *
     * @param plotId    地块业务主键，可为空
     * @param deviceId  设备业务主键，可为空
     * @param startDate 起始日期 yyyy-MM-dd，可为空
     * @param endDate   结束日期 yyyy-MM-dd，可为空
     * @param page      页码，默认 1
     * @param size      每页条数，默认 10
     * @return 宽表环境数据分页结果
     */
    @GetMapping("/environment")
    public ApiResponse<PageResult<EnvironmentData>> environment(
            @RequestParam(required = false) String plotId,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size) {
        return ApiResponse.ok(iotReadingService.environmentPage(plotId, deviceId,
                DateParams.parseDate(startDate), DateParams.parseDate(endDate), page, size));
    }

    /**
     * 环境数据原始窄表行（未透视），保留给需要逐条读数的场景。
     *
     * @param plotId    地块业务主键，可为空
     * @param deviceId  设备业务主键，可为空
     * @param startDate 起始日期 yyyy-MM-dd，可为空
     * @param endDate   结束日期 yyyy-MM-dd，可为空
     * @param limit     返回条数上限，默认 200，上限 2000
     * @return 原始读数列表
     */
    @GetMapping("/environment/raw")
    public ApiResponse<List<IotReadingEntity>> environmentRaw(
            @RequestParam(required = false) String plotId,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) Integer limit) {
        return ApiResponse.ok(iotReadingService.environmentRaw(plotId, deviceId,
                DateParams.parseDate(startDate), DateParams.parseDate(endDate), limit));
    }

    /**
     * 环境趋势（原始读数，窄表行）。
     *
     * <p>修复参数口径：原实现强制要求 {@code deviceId} 且忽略日期范围，
     * 而前端按 {@code plotId + startDate/endDate} 调用，会直接 400。
     * 现 {@code deviceId} 改为可选，并支持 {@code plotId} 与日期区间过滤；
     * 返回结构保持 {@code IotReadingEntity[]} 不变，不破坏既有调用。</p>
     *
     * @param deviceId  设备业务主键，可为空
     * @param plotId    地块业务主键，可为空
     * @param metric    指标名，可为空（单个指标；多指标请用 /environment/history）
     * @param startDate 起始日期 yyyy-MM-dd，可为空
     * @param endDate   结束日期 yyyy-MM-dd，可为空
     * @return 原始读数列表（按采集时间升序）
     */
    @GetMapping("/environment/trend")
    public ApiResponse<List<IotReadingEntity>> environmentTrend(
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String plotId,
            @RequestParam(required = false) String metric,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        return ApiResponse.ok(iotReadingService.series(deviceId, plotId, metric,
                DateParams.parseDate(startDate), DateParams.parseDate(endDate)));
    }

    /**
     * 环境趋势（多指标聚合，地块维度）。
     *
     * <p>与 {@code /iot/devices/{deviceId}/env-history} 返回同一结构，
     * 供按地块查看环境曲线的页面（地块详情、生长总览）使用。</p>
     *
     * @param plotId    地块业务主键
     * @param metrics   逗号分隔指标名，可为空（默认 temperature）
     * @param startDate 起始日期 yyyy-MM-dd，可为空
     * @param endDate   结束日期 yyyy-MM-dd，可为空
     * @return 环境趋势（dates / series / temperatures）
     */
    @GetMapping("/environment/history")
    public ApiResponse<EnvTrendVO> environmentHistory(@RequestParam String plotId,
                                                      @RequestParam(required = false) String metrics,
                                                      @RequestParam(required = false) String startDate,
                                                      @RequestParam(required = false) String endDate) {
        return ApiResponse.ok(iotReadingService.envHistory(null, plotId, metrics,
                DateParams.parseDate(startDate), DateParams.parseDate(endDate)));
    }

    /** 生长总览 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview(@RequestParam(required = false) String plotId) {
        return ApiResponse.ok(growthRecordService.overview(plotId));
    }
}
