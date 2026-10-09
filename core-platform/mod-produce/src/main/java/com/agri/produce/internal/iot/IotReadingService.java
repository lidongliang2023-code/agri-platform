package com.agri.produce.internal.iot;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.produce.internal.growth.EnvironmentData;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * IoT 监测读数（时序，卫星服务回传） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class IotReadingService {

    private static final String ID_PREFIX = "READ";

    // ---------------------------------------------------------------- 环境指标规范码
    // prod_iot_reading.metric 是自由文本（窄表：一行一个指标），此处定义本模块认可的规范码，
    // 卫星服务 satellite-iot 上报时须使用这些码，否则趋势图取不到数据。

    /** 空气温度（℃） */
    public static final String METRIC_AIR_TEMPERATURE = "air_temperature";
    /** 空气湿度（%） */
    public static final String METRIC_AIR_HUMIDITY = "air_humidity";
    /** 土壤温度（℃） */
    public static final String METRIC_SOIL_TEMPERATURE = "soil_temperature";
    /** 土壤湿度（%） */
    public static final String METRIC_SOIL_MOISTURE = "soil_moisture";
    /** 光照强度（lux） */
    public static final String METRIC_ILLUMINANCE = "illuminance";
    /** 二氧化碳浓度（ppm） */
    public static final String METRIC_CO2 = "co2";
    /** 降雨量（mm） */
    public static final String METRIC_RAINFALL = "rainfall";

    /** 规范指标码清单（顺序即 series 的键顺序） */
    public static final List<String> CANONICAL_METRICS = List.of(
            METRIC_AIR_TEMPERATURE, METRIC_AIR_HUMIDITY, METRIC_SOIL_TEMPERATURE,
            METRIC_SOIL_MOISTURE, METRIC_ILLUMINANCE, METRIC_CO2, METRIC_RAINFALL);

    /** 指标别名 → 规范码（含 camelCase 由 toSnake 兜底） */
    private static final Map<String, String> METRIC_ALIAS = Map.ofEntries(
            Map.entry(METRIC_AIR_TEMPERATURE, METRIC_AIR_TEMPERATURE),
            Map.entry(METRIC_AIR_HUMIDITY, METRIC_AIR_HUMIDITY),
            Map.entry(METRIC_SOIL_TEMPERATURE, METRIC_SOIL_TEMPERATURE),
            Map.entry(METRIC_SOIL_MOISTURE, METRIC_SOIL_MOISTURE),
            Map.entry(METRIC_ILLUMINANCE, METRIC_ILLUMINANCE),
            Map.entry(METRIC_CO2, METRIC_CO2),
            Map.entry(METRIC_RAINFALL, METRIC_RAINFALL),
            Map.entry("temperature", METRIC_AIR_TEMPERATURE),
            Map.entry("humidity", METRIC_AIR_HUMIDITY),
            Map.entry("soil_temp", METRIC_SOIL_TEMPERATURE),
            Map.entry("soil_moist", METRIC_SOIL_MOISTURE));

    /** 未传 metrics 时的默认指标 */
    private static final String DEFAULT_METRIC = "temperature";

    /** 宽表透视时读取的窄表源行上限（防止大范围查询把内存打满） */
    private static final int PIVOT_SOURCE_LIMIT = 5000;

    private static final Pattern SNAKE_PATTERN = Pattern.compile("([A-Z])");

    private final IotReadingMapper iotReadingMapper;

    /**
     * 分页查询。
     *
     * @return 分页结果
     */
    public PageResult<IotReadingEntity> page(long page, long size) {
        Page<IotReadingEntity> result = iotReadingMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<IotReadingEntity>()
                        .orderByDesc(IotReadingEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public IotReadingEntity detail(String id) {
        IotReadingEntity entity = iotReadingMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public IotReadingEntity create(IotReadingEntity entity) {
        if (entity.getReadingId() == null || entity.getReadingId().isBlank()) {
            entity.setReadingId(ProduceIds.newId(ID_PREFIX));
        }
        iotReadingMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public IotReadingEntity update(String id, IotReadingEntity entity) {
        entity.setReadingId(id);
        iotReadingMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        iotReadingMapper.deleteById(id);
    }

    /** 设备最新一条读数 */
    public IotReadingEntity latest(String deviceId) {
        List<IotReadingEntity> list = iotReadingMapper.selectList(new LambdaQueryWrapper<IotReadingEntity>()
                .eq(IotReadingEntity::getDeviceId, deviceId)
                .orderByDesc(IotReadingEntity::getReadTime)
                .last("LIMIT 1"));
        return list.isEmpty() ? null : list.get(0);
    }

    /** 指定指标时序（告警判定/曲线展示） */
    public List<IotReadingEntity> series(String deviceId, String plotId, String metric,
                                         LocalDate from, LocalDate to) {
        LocalDateTime rangeFrom = from == null ? null : from.atStartOfDay();
        // 结束日期按「含当天」处理，故取下一天零点做开区间上界
        LocalDateTime rangeTo = to == null ? null : to.plusDays(1).atStartOfDay();
        return iotReadingMapper.selectList(new LambdaQueryWrapper<IotReadingEntity>()
                .eq(deviceId != null && !deviceId.isBlank(), IotReadingEntity::getDeviceId, deviceId)
                .eq(plotId != null && !plotId.isBlank(), IotReadingEntity::getPlotId, plotId)
                .eq(metric != null && !metric.isBlank(), IotReadingEntity::getMetric, metric)
                .ge(rangeFrom != null, IotReadingEntity::getReadTime, rangeFrom)
                .lt(rangeTo != null, IotReadingEntity::getReadTime, rangeTo)
                .orderByAsc(IotReadingEntity::getReadTime));
    }

    /** 环境读数（可按地块过滤，取最近 200 条） */
    public List<IotReadingEntity> listEnvironment(String plotId) {
        return iotReadingMapper.selectList(new LambdaQueryWrapper<IotReadingEntity>()
                .eq(plotId != null && !plotId.isBlank(), IotReadingEntity::getPlotId, plotId)
                .orderByDesc(IotReadingEntity::getReadTime)
                .last("LIMIT 200"));
    }

    // ------------------------------------------------------------------ 多指标环境趋势

    /**
     * 多指标环境趋势：把窄表读数按「日期 × 指标」透视成前端可直接画曲线的结构。
     *
     * <p>{@code metrics} 为空时默认取 {@code temperature}（解析为规范码
     * {@code air_temperature}），保持既有单指标调用的行为不变。</p>
     *
     * @param deviceId 设备业务主键，可为空（与 plotId 至少传一个）
     * @param plotId   地块业务主键，可为空
     * @param metrics  逗号分隔指标名，支持规范码 / camelCase / 常用别名，可为空
     * @param from     起始日期（含），可为空
     * @param to       结束日期（含），可为空
     * @return 环境趋势 VO
     */
    public EnvTrendVO envHistory(String deviceId, String plotId, String metrics,
                                 LocalDate from, LocalDate to) {
        List<String> canonical = resolveMetrics(metrics);
        if (canonical.isEmpty()) {
            return EnvTrendVO.empty();
        }

        LocalDateTime rangeFrom = from == null ? null : from.atStartOfDay();
        LocalDateTime rangeTo = to == null ? null : to.plusDays(1).atStartOfDay();

        List<IotReadingEntity> rows = iotReadingMapper.selectList(new LambdaQueryWrapper<IotReadingEntity>()
                .eq(deviceId != null && !deviceId.isBlank(), IotReadingEntity::getDeviceId, deviceId)
                .eq(plotId != null && !plotId.isBlank(), IotReadingEntity::getPlotId, plotId)
                .in(IotReadingEntity::getMetric, canonical)
                .ge(rangeFrom != null, IotReadingEntity::getReadTime, rangeFrom)
                .lt(rangeTo != null, IotReadingEntity::getReadTime, rangeTo)
                .orderByAsc(IotReadingEntity::getReadTime));

        if (rows.isEmpty()) {
            return EnvTrendVO.empty();
        }

        // 日期 × 指标 聚合（同一天同一指标取最新一条）
        Map<LocalDate, Map<String, Double>> byDate = new TreeMap<>();
        for (IotReadingEntity row : rows) {
            if (row.getReadTime() == null || row.getMetric() == null || row.getMetricValue() == null) {
                continue;
            }
            LocalDate day = row.getReadTime().toLocalDate();
            byDate.computeIfAbsent(day, key -> new LinkedHashMap<>())
                    .put(row.getMetric(), row.getMetricValue().doubleValue());
        }

        List<String> dates = new ArrayList<>(byDate.size());
        for (LocalDate day : byDate.keySet()) {
            dates.add(day.toString());
        }

        Map<String, List<Double>> series = new LinkedHashMap<>();
        for (String metric : canonical) {
            List<Double> values = new ArrayList<>(dates.size());
            for (LocalDate day : byDate.keySet()) {
                values.add(byDate.get(day).get(metric));
            }
            series.put(metric, values);
        }

        EnvTrendVO vo = new EnvTrendVO();
        vo.setDates(dates);
        vo.setSeries(series);
        // 未请求 air_temperature 时给空数组而非 null，避免前端 .map/.length 直接 NPE
        vo.setTemperatures(series.getOrDefault(METRIC_AIR_TEMPERATURE, Collections.emptyList()));
        return vo;
    }

    /**
     * 解析并规范化指标名。
     *
     * <p>支持三类输入：规范 snake_case 码、camelCase（如 {@code airTemperature}）、
     * 以及常用别名（{@code temperature} → {@code air_temperature}、
     * {@code humidity} → {@code air_humidity}）。未识别的指标名直接丢弃，不伪造。</p>
     *
     * @param metrics 逗号分隔指标名，可为空
     * @return 规范指标码列表（去重、保持输入顺序）
     */
    public List<String> resolveMetrics(String metrics) {
        String raw = (metrics == null || metrics.isBlank()) ? DEFAULT_METRIC : metrics;
        List<String> result = new ArrayList<>();
        for (String part : raw.split(",")) {
            String trimmed = part == null ? "" : part.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            String canonical = METRIC_ALIAS.getOrDefault(trimmed,
                    METRIC_ALIAS.getOrDefault(toSnake(trimmed), null));
            if (canonical != null && !result.contains(canonical)
                    && CANONICAL_METRICS.contains(canonical)) {
                result.add(canonical);
            }
        }
        return result;
    }

    /**
     * camelCase 转 snake_case。
     *
     * @param name 原始名
     * @return snake_case 形式
     */
    private static String toSnake(String name) {
        return SNAKE_PATTERN.matcher(name).replaceAll("_$1").toLowerCase(Locale.ROOT);
    }

    // ------------------------------------------------------------------ 宽表透视

    /**
     * 环境数据（宽表，分页）：把窄表读数按「设备 + 地块 + 采集时刻」透视成前端
     * {@code EnvironmentData} 结构。
     *
     * <p>缺采指标留 {@code null}，<b>不补 0</b>。</p>
     *
     * @param plotId   地块业务主键，可为空
     * @param deviceId 设备业务主键，可为空
     * @param from     起始日期（含），可为空
     * @param to       结束日期（含），可为空
     * @param page     页码，从 1 开始
     * @param size     每页条数
     * @return 宽表分页结果
     */
    public PageResult<EnvironmentData> environmentPage(String plotId, String deviceId,
                                                       LocalDate from, LocalDate to,
                                                       long page, long size) {
        List<EnvironmentData> all = pivotToWide(plotId, deviceId, from, to);
        long total = all.size();
        long safePage = Math.max(1, page);
        long safeSize = Math.max(1, size);
        long offset = (safePage - 1) * safeSize;
        List<EnvironmentData> records = offset >= total
                ? Collections.emptyList()
                : all.subList((int) offset, (int) Math.min(offset + safeSize, total));
        return PageResult.of(records, total, safePage, safeSize);
    }

    /**
     * 环境数据原始窄表行（未透视），供需要逐条读数的场景使用。
     *
     * @param plotId   地块业务主键，可为空
     * @param deviceId 设备业务主键，可为空
     * @param from     起始日期（含），可为空
     * @param to       结束日期（含），可为空
     * @param limit    返回条数上限，默认 200，上限 2000
     * @return 原始读数列表
     */
    public List<IotReadingEntity> environmentRaw(String plotId, String deviceId,
                                                 LocalDate from, LocalDate to, Integer limit) {
        int max = (limit == null || limit <= 0) ? 200 : Math.min(limit, 2000);
        LocalDateTime rangeFrom = from == null ? null : from.atStartOfDay();
        LocalDateTime rangeTo = to == null ? null : to.plusDays(1).atStartOfDay();
        return iotReadingMapper.selectList(new LambdaQueryWrapper<IotReadingEntity>()
                .eq(deviceId != null && !deviceId.isBlank(), IotReadingEntity::getDeviceId, deviceId)
                .eq(plotId != null && !plotId.isBlank(), IotReadingEntity::getPlotId, plotId)
                .ge(rangeFrom != null, IotReadingEntity::getReadTime, rangeFrom)
                .lt(rangeTo != null, IotReadingEntity::getReadTime, rangeTo)
                .orderByDesc(IotReadingEntity::getReadTime)
                .last("LIMIT " + max));
    }

    /**
     * 窄表 → 宽表透视。
     *
     * <p>分组键为「设备 + 地块 + 采集时刻」：同一时刻上报的多个指标合并为一行；
     * 同一组内同一指标重复上报时取最后一条（后到的覆盖先到的）。</p>
     *
     * @param plotId   地块业务主键，可为空
     * @param deviceId 设备业务主键，可为空
     * @param from     起始日期（含），可为空
     * @param to       结束日期（含），可为空
     * @return 宽表行（按采集时间倒序）
     */
    private List<EnvironmentData> pivotToWide(String plotId, String deviceId, LocalDate from, LocalDate to) {
        // 注意：条件为 false 时 MyBatis-Plus 仍会先求值入参，故此处必须先算好再传，
        // 否则 from/to 为 null 时 .atStartOfDay() 直接 NPE
        LocalDateTime rangeFrom = from == null ? null : from.atStartOfDay();
        LocalDateTime rangeTo = to == null ? null : to.plusDays(1).atStartOfDay();
        List<IotReadingEntity> rows = iotReadingMapper.selectList(new LambdaQueryWrapper<IotReadingEntity>()
                .eq(deviceId != null && !deviceId.isBlank(), IotReadingEntity::getDeviceId, deviceId)
                .eq(plotId != null && !plotId.isBlank(), IotReadingEntity::getPlotId, plotId)
                .ge(rangeFrom != null, IotReadingEntity::getReadTime, rangeFrom)
                .lt(rangeTo != null, IotReadingEntity::getReadTime, rangeTo)
                .orderByAsc(IotReadingEntity::getReadTime)
                .last("LIMIT " + PIVOT_SOURCE_LIMIT));

        // 采集时刻倒序：最新的一条在最前
        Map<String, EnvironmentData> grouped = new LinkedHashMap<>();
        List<EnvironmentData> result = new ArrayList<>();
        Map<String, Integer> indexOf = new HashMap<>();

        for (IotReadingEntity row : rows) {
            LocalDateTime readTime = row.getReadTime();
            if (readTime == null || row.getMetric() == null) {
                continue;
            }
            String canonical = METRIC_ALIAS.getOrDefault(row.getMetric().trim(),
                    METRIC_ALIAS.getOrDefault(toSnake(row.getMetric().trim()), null));
            if (canonical == null || !CANONICAL_METRICS.contains(canonical)) {
                continue;
            }
            String key = (row.getDeviceId() == null ? "-" : row.getDeviceId())
                    + "|" + (row.getPlotId() == null ? "-" : row.getPlotId())
                    + "|" + readTime.toString();

            EnvironmentData data = grouped.get(key);
            if (data == null) {
                data = new EnvironmentData();
                data.setDataId(row.getReadingId());
                data.setDeviceId(row.getDeviceId());
                data.setPlotId(row.getPlotId());
                data.setCollectedAt(readTime);
                // 数据来自卫星服务 satellite-iot 回传，故固定为「物联网设备」
                data.setSource(EnvironmentData.SOURCE_IOT);
                grouped.put(key, data);
                indexOf.put(key, result.size());
                result.add(data);
            }
            Double value = row.getMetricValue() == null ? null : row.getMetricValue().doubleValue();
            switch (canonical) {
                case METRIC_AIR_TEMPERATURE -> data.setAirTemperature(value);
                case METRIC_AIR_HUMIDITY -> data.setAirHumidity(value);
                case METRIC_SOIL_TEMPERATURE -> data.setSoilTemperature(value);
                case METRIC_SOIL_MOISTURE -> data.setSoilMoisture(value);
                case METRIC_ILLUMINANCE -> data.setIlluminance(value);
                case METRIC_CO2 -> data.setCo2(value);
                case METRIC_RAINFALL -> data.setRainfall(value);
                default -> {
                    // 规范码已在 CANONICAL_METRICS 内收敛，此处不可达
                }
            }
        }

        result.sort((a, b) -> b.getCollectedAt().compareTo(a.getCollectedAt()));
        return result;
    }
}
