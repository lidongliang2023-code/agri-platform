package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.IoTDevice;
import com.agri.production.entity.Plot;
import com.agri.production.entity.SensorData;
import com.agri.production.mapper.IoTDeviceMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.SensorDataMapper;
import com.agri.production.service.ISensorPivotService;
import com.agri.production.vo.EnvTrendVO;
import com.agri.production.vo.EnvironmentDataVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Pattern;

/**
 * 传感器长表透视实现（growth / iot 共用）。
 *
 * <p>库内 {@code agri_prod_sensor_data} 一行一个 {@code sensor_type + value + unit}；
 * 页面的环境数据是宽表、环境曲线是按天聚合。这里做两件事：透视与按天聚合。</p>
 */
@Slf4j
@Service
public class SensorPivotServiceImpl implements ISensorPivotService {

    /* ------------------------------ 指标规范码 ------------------------------ */

    private static final String AIR_TEMPERATURE = "air_temperature";
    private static final String AIR_HUMIDITY = "air_humidity";
    private static final String SOIL_TEMPERATURE = "soil_temperature";
    private static final String SOIL_MOISTURE = "soil_moisture";
    private static final String ILLUMINANCE = "illuminance";
    private static final String CO2 = "co2";
    private static final String RAINFALL = "rainfall";

    private static final List<String> CANONICAL = List.of(
            AIR_TEMPERATURE, AIR_HUMIDITY, SOIL_TEMPERATURE, SOIL_MOISTURE,
            ILLUMINANCE, CO2, RAINFALL);

    /**
     * camelCase → snake_case 用的正则。
     *
     * <p><b>必须声明在 {@link #ALIAS} 之前</b>：静态字段按声明顺序初始化，而
     * {@code buildAliases()} 内部要调 {@code toSnake()}。反过来的话，初始化 ALIAS 时 CAMEL 还是
     * null，报的是 {@code ExceptionInInitializerError / NPE: CAMEL is null} —— 一个和"别名表写错"
     * 毫无关系、只在启动时炸一次的错误（实测踩过）。</p>
     */
    private static final Pattern CAMEL = Pattern.compile("([A-Z])");

    /**
     * 原始指标名 → 规范码。
     *
     * <p>为什么要这张表：库里 {@code sensor_type} 是自由文本 —— 演示/历史数据里同一件事有
     * {@code temperature}、{@code air_temperature}、{@code 空气温度} 三种写法（平台侧
     * {@code prod_iot_reading.metric} 里更是中文名占多数）。不做归一，宽表会按写法各建一列，
     * 页面上的温度曲线就会"有时有、有时没有"。</p>
     */
    private static final Map<String, String> ALIAS = buildAliases();
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 透视时从长表读取的行数上限：演示/单地块规模下够用，避免无界查询把内存打满。 */
    private static final int PIVOT_SOURCE_LIMIT = 5000;

    private final SensorDataMapper sensorDataMapper;
    private final PlotMapper plotMapper;
    private final IoTDeviceMapper deviceMapper;

    public SensorPivotServiceImpl(SensorDataMapper sensorDataMapper, PlotMapper plotMapper,
                                  IoTDeviceMapper deviceMapper) {
        this.sensorDataMapper = sensorDataMapper;
        this.plotMapper = plotMapper;
        this.deviceMapper = deviceMapper;
    }

    /* ============================== 对外能力 ============================== */

    @Override
    public String canonicalMetric(String raw) {
        if (raw == null) {
            return null;
        }
        String text = raw.trim();
        if (text.isEmpty()) {
            return null;
        }
        String canonical = ALIAS.get(text);
        if (canonical == null) {
            canonical = ALIAS.get(toSnake(text));
        }
        return canonical != null && CANONICAL.contains(canonical) ? canonical : null;
    }

    @Override
    public List<String> canonicalMetrics() {
        return CANONICAL;
    }

    @Override
    public PageResult<EnvironmentDataVO> environmentPage(String tenantId, String plotId, String deviceId,
                                                         String startDate, String endDate,
                                                         int pageNum, int pageSize) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        List<EnvironmentDataVO> all = pivot(tenantId, plotId, deviceId, startDate, endDate);
        long total = all.size();
        long offset = (long) (p - 1) * s;
        List<EnvironmentDataVO> records = offset >= total
                ? Collections.emptyList()
                : all.subList((int) offset, (int) Math.min(offset + s, total));
        return PageResult.of(records, total, p, s);
    }

    @Override
    public EnvTrendVO history(String tenantId, String plotId, String deviceId, String metrics,
                              String startDate, String endDate) {
        List<String> wanted = resolveMetrics(metrics);
        if (wanted.isEmpty()) {
            return EnvTrendVO.empty();
        }
        Filter filter = new Filter(tenantId, plotId, deviceId,
                parseDate(startDate, "startDate"), parseDate(endDate, "endDate"));
        if (filter.unresolvable()) {
            return EnvTrendVO.empty();
        }
        // 库里存的是原始写法，所以按"能映射到目标规范码的原始名"去过滤；
        // 直接拿规范码去 in(sensor_type) 会一条都查不到（历史/演示数据里写的是 temperature 等）。
        Set<String> rawNames = new LinkedHashSet<>();
        for (Map.Entry<String, String> entry : ALIAS.entrySet()) {
            if (wanted.contains(entry.getValue())) {
                rawNames.add(entry.getKey());
            }
        }
        List<SensorData> rows = query(filter, rawNames);

        // 日期 × 指标：同日多次采集先聚 min/avg/max/count，序列里给均值
        Map<LocalDate, Map<String, double[]>> acc = new TreeMap<>();
        for (SensorData row : rows) {
            if (row.getDataTime() == null || row.getValue() == null) {
                continue;
            }
            String canonical = canonicalMetric(row.getSensorType());
            if (canonical == null || !wanted.contains(canonical)) {
                continue;
            }
            double[] slot = acc.computeIfAbsent(row.getDataTime().toLocalDate(), k -> new HashMap<>())
                    // [min, max, sum, count]：max 必须用 -Double.MAX_VALUE 起头 ——
                    // Double.MIN_VALUE 是"最小正数"而不是"最小负数"，用它起头会让负值（如 -3℃）
                    // 永远算不进最大值里，而且错得毫无征兆。
                    .computeIfAbsent(canonical, k -> new double[]{Double.MAX_VALUE, -Double.MAX_VALUE, 0d, 0d});
            double value = row.getValue().doubleValue();
            slot[0] = Math.min(slot[0], value);
            slot[1] = Math.max(slot[1], value);
            slot[2] += value;
            slot[3] += 1;
        }
        if (acc.isEmpty()) {
            return EnvTrendVO.empty();
        }

        EnvTrendVO vo = new EnvTrendVO();
        List<String> dates = new ArrayList<>(acc.size());
        for (LocalDate day : acc.keySet()) {
            dates.add(DATE.format(day));
        }
        vo.setDates(dates);

        Map<String, List<Double>> series = new LinkedHashMap<>();
        Map<String, Map<String, Map<String, Double>>> stats = new LinkedHashMap<>();
        for (String metric : wanted) {
            List<Double> values = new ArrayList<>(dates.size());
            Map<String, Map<String, Double>> perDay = new LinkedHashMap<>();
            for (LocalDate day : acc.keySet()) {
                double[] slot = acc.get(day).get(metric);
                if (slot == null) {
                    values.add(null);
                    continue;
                }
                double min = round(slot[0]);
                double max = round(slot[1]);
                double avg = round(slot[2] / slot[3]);
                values.add(avg);
                Map<String, Double> item = new LinkedHashMap<>();
                item.put("min", min);
                item.put("avg", avg);
                item.put("max", max);
                item.put("count", slot[3]);
                perDay.put(DATE.format(day), item);
            }
            series.put(metric, values);
            stats.put(metric, perDay);
        }
        vo.setSeries(series);
        // 未请求空气温度时给空数组而不是 null：前端直接读 .length/.map
        vo.setTemperatures(series.getOrDefault(AIR_TEMPERATURE, Collections.emptyList()));
        vo.setStats(stats);
        return vo;
    }

    /* ============================== 透视主体 ============================== */

    /**
     * 长表 → 宽表。
     *
     * <p>分组键是「设备 + 地块 + 采集时刻」：同一时刻上报的多个指标合并成一行。
     * 没有采集时间的行直接跳过（不借用创建时间去顶替 —— 那会造出一个并不存在的采样时刻）。</p>
     */
    private List<EnvironmentDataVO> pivot(String tenantId, String plotId, String deviceId,
                                          String startDate, String endDate) {
        Filter filter = new Filter(tenantId, plotId, deviceId,
                parseDate(startDate, "startDate"), parseDate(endDate, "endDate"));
        if (filter.unresolvable()) {
            return Collections.emptyList();
        }
        List<SensorData> rows = query(filter, null);

        Map<String, Bucket> grouped = new LinkedHashMap<>();
        int unknown = 0;
        for (SensorData row : rows) {
            if (row.getDataTime() == null) {
                continue;
            }
            String canonical = canonicalMetric(row.getSensorType());
            if (canonical == null) {
                unknown++;
                continue;
            }
            String key = (row.getDeviceId() == null ? "-" : row.getDeviceId())
                    + "|" + (row.getPlotId() == null ? "-" : row.getPlotId())
                    + "|" + row.getDataTime();
            Bucket bucket = grouped.get(key);
            if (bucket == null) {
                bucket = new Bucket(row);
                grouped.put(key, bucket);
            }
            bucket.set(canonical, row.getValue());
        }
        if (unknown > 0) {
            // 认不出的 sensor_type 不进宽表（页面没有对应列），但要在日志里看得见 ——
            // 否则"某类新传感器上报了数据、页面上永远没有"会完全无声。
            log.debug("环境透视：{} 行 sensor_type 无法映射到页面指标，已跳过（租户 {}）", unknown, tenantId);
        }

        Map<Long, String> plotNames = plotNames(grouped.values());
        List<Bucket> buckets = new ArrayList<>(grouped.values());
        buckets.sort((a, b) -> b.dataTime.compareTo(a.dataTime));
        List<EnvironmentDataVO> result = new ArrayList<>(buckets.size());
        for (Bucket bucket : buckets) {
            result.add(bucket.toVO(plotNames));
        }
        return result;
    }

    /**
     * 按地块主键批量取地块名。
     *
     * <p>长表里只有 plot_id，没有地块名；一次批量查而不是逐行查（N+1）。查不到的（例如
     * 地块主数据里没有该 id）就留 null —— 页面显示"-"，不拿 id 冒充名字。</p>
     */
    private Map<Long, String> plotNames(java.util.Collection<Bucket> buckets) {
        Set<Long> ids = new LinkedHashSet<>();
        for (Bucket bucket : buckets) {
            if (bucket.plotId != null) {
                ids.add(bucket.plotId);
            }
        }
        Map<Long, String> names = new HashMap<>();
        if (ids.isEmpty()) {
            return names;
        }
        for (Plot plot : plotMapper.selectBatchIds(ids)) {
            names.put(plot.getId(), plot.getPlotName());
        }
        return names;
    }

    /* ============================== 查询与解析 ============================== */

    private List<SensorData> query(Filter filter, Set<String> rawMetricNames) {
        LocalDateTime from = filter.from == null ? null : filter.from.atStartOfDay();
        // 结束日期按"含当天"处理，取下一天零点做开区间上界
        LocalDateTime to = filter.to == null ? null : filter.to.plusDays(1).atStartOfDay();
        LambdaQueryWrapper<SensorData> w = new LambdaQueryWrapper<SensorData>()
                .eq(SensorData::getTenantId, filter.tenantId)
                .eq(filter.plotKey != null, SensorData::getPlotId, filter.plotKey)
                .eq(filter.deviceKey != null, SensorData::getDeviceId, filter.deviceKey)
                .ge(from != null, SensorData::getDataTime, from)
                .lt(to != null, SensorData::getDataTime, to)
                .orderByAsc(SensorData::getDataTime)
                .last("LIMIT " + PIVOT_SOURCE_LIMIT);
        if (rawMetricNames != null && !rawMetricNames.isEmpty()) {
            w.in(SensorData::getSensorType, rawMetricNames);
        }
        return sensorDataMapper.selectList(w);
    }

    /**
     * 解析指标名清单（逗号分隔）。
     *
     * <p>未识别的指标名直接丢弃，不用默认值顶替：调用方要的是"二氧化碳"，若被默默换成空气温度，
     * 页面上的曲线标题与数据会对不上。全都识别不出时返回空清单，由调用方给空趋势。</p>
     */
    private List<String> resolveMetrics(String metrics) {
        String raw = metrics == null || metrics.isBlank() ? "temperature" : metrics;
        List<String> result = new ArrayList<>();
        for (String part : raw.split(",")) {
            String canonical = canonicalMetric(part);
            if (canonical != null && !result.contains(canonical)) {
                result.add(canonical);
            } else if (canonical == null && part != null && !part.isBlank()) {
                log.warn("环境趋势：指标名无法识别，已忽略：{}", part.trim());
            }
        }
        return result;
    }

    private LocalDate parseDate(String text, String field) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(text.trim());
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, field + " 格式应为 yyyy-MM-dd：" + text.trim());
        }
    }

    private static double round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private static Map<String, String> buildAliases() {
        Map<String, String> map = new HashMap<>();
        put(map, AIR_TEMPERATURE, "air_temperature", "temperature", "air_temp", "temp", "空气温度", "气温");
        put(map, AIR_HUMIDITY, "air_humidity", "humidity", "air_humid", "空气湿度", "湿度");
        put(map, SOIL_TEMPERATURE, "soil_temperature", "soil_temp", "土壤温度", "地温");
        put(map, SOIL_MOISTURE, "soil_moisture", "soil_moist", "soil_humidity", "土壤湿度", "土壤含水量", "墒情");
        put(map, ILLUMINANCE, "illuminance", "light", "lux", "光照强度", "光照");
        put(map, CO2, "co2", "carbon_dioxide", "co2_concentration", "二氧化碳浓度", "CO2浓度");
        put(map, RAINFALL, "rainfall", "rain", "precipitation", "降雨量", "雨量");
        return Collections.unmodifiableMap(map);
    }

    private static void put(Map<String, String> map, String canonical, String... names) {
        for (String name : names) {
            map.put(name, canonical);
            map.put(toSnake(name), canonical);
        }
    }

    private static String toSnake(String name) {
        return CAMEL.matcher(name).replaceAll("_$1").toLowerCase(Locale.ROOT);
    }

    /* ============================== 内部结构 ============================== */

    /**
     * 查询过滤条件（已解析成主键）。
     *
     * <p>{@code plotKey}/{@code deviceKey} 为 null 表示"不筛"；{@code unresolvedFilter} 非空表示
     * 调用方给了筛选值但本服务认不出对应主键 —— 此时返回空结果（见 {@link #unresolvable()} 的说明）。</p>
     */
    private final class Filter {
        private final String tenantId;
        private final Long plotKey;
        private final Long deviceKey;
        private final LocalDate from;
        private final LocalDate to;
        private final String unresolvedFilter;

        private Filter(String tenantId, String plotId, String deviceId, LocalDate from, LocalDate to) {
            if (tenantId == null || tenantId.isBlank()) {
                throw new BusinessException(500, "租户上下文为空，无法查询环境数据");
            }
            this.tenantId = tenantId;
            this.from = from;
            this.to = to;
            Resolution plot = resolvePlot(plotId);
            Resolution device = resolveDevice(deviceId);
            this.plotKey = plot.key;
            this.deviceKey = device.key;
            this.unresolvedFilter = plot.unresolved != null ? plot.unresolved : device.unresolved;
            if (unresolvedFilter != null) {
                log.warn("环境数据筛选值无法换算成本地主键，按空结果处理：{}（本阶段地块/设备主数据与页面标识尚未收敛）",
                        unresolvedFilter);
            }
        }

        private boolean unresolvable() {
            return unresolvedFilter != null;
        }
    }

    /** 解析结果：{@code key} 为 null 表示"没传筛选"；{@code unresolved} 非空表示"传了但认不出"。 */
    private record Resolution(Long key, String unresolved) {
        private static Resolution none() {
            return new Resolution(null, null);
        }

        private static Resolution of(Long key) {
            return new Resolution(key, null);
        }

        private static Resolution unresolved(String raw) {
            return new Resolution(null, raw);
        }
    }

    /**
     * 地块标识 → 本地地块主键。
     *
     * <p>接受：本地数字主键、地块编码（{@code plot_code}，如 P001）。
     * <b>认不出时返回 unresolved，由调用方给空结果</b> —— 这里刻意不抛 400：
     * 页面上的地块下拉目前来自仍留在平台侧的 {@code GET /plots}，回传的是 {@code DEMO-PLOT-001}
     * 这类平台标识；在"地块主数据收敛"那一轮完成前本服务无法换算（详见本轮方案第六节）。
     * 抛 400 会让页面直接报错、连"没数据"都看不到；返回其它地块的数据更糟（看起来筛选生效了）。
     * 因此选择"空结果 + 服务端 WARN 日志"，并在交付说明里记为遗留。</p>
     */
    private Resolution resolvePlot(String raw) {
        if (raw == null || raw.isBlank()) {
            return Resolution.none();
        }
        String text = raw.trim();
        if (text.chars().allMatch(Character::isDigit)) {
            try {
                return Resolution.of(Long.valueOf(text));
            } catch (NumberFormatException e) {
                // 纯数字但超出 Long 范围：继续按编码查
            }
        }
        Plot plot = plotMapper.selectOne(new LambdaQueryWrapper<Plot>()
                .eq(Plot::getPlotCode, text)
                .last("LIMIT 1"));
        return plot != null ? Resolution.of(plot.getId()) : Resolution.unresolved(text);
    }

    /** 设备标识 → 本地设备主键（数字主键或 device_code），认不出时按空结果处理（理由同上）。 */
    private Resolution resolveDevice(String raw) {
        if (raw == null || raw.isBlank()) {
            return Resolution.none();
        }
        String text = raw.trim();
        if (text.chars().allMatch(Character::isDigit)) {
            try {
                return Resolution.of(Long.valueOf(text));
            } catch (NumberFormatException e) {
                // 落到编码查询
            }
        }
        IoTDevice device = deviceMapper.selectOne(new LambdaQueryWrapper<IoTDevice>()
                .eq(IoTDevice::getDeviceCode, text)
                .last("LIMIT 1"));
        return device != null ? Resolution.of(device.getId()) : Resolution.unresolved(text);
    }

    /** 宽表一行（同一设备+地块+采集时刻）。 */
    private static final class Bucket {
        private final Long deviceId;
        private final Long plotId;
        private final LocalDateTime dataTime;
        private final Long firstId;
        private Double airTemperature;
        private Double airHumidity;
        private Double soilTemperature;
        private Double soilMoisture;
        private Double illuminance;
        private Double co2;
        private Double rainfall;

        private Bucket(SensorData row) {
            this.deviceId = row.getDeviceId();
            this.plotId = row.getPlotId();
            this.dataTime = row.getDataTime();
            this.firstId = row.getId();
        }

        private void set(String canonical, BigDecimal value) {
            Double v = value == null ? null : value.doubleValue();
            switch (canonical) {
                case AIR_TEMPERATURE -> this.airTemperature = v;
                case AIR_HUMIDITY -> this.airHumidity = v;
                case SOIL_TEMPERATURE -> this.soilTemperature = v;
                case SOIL_MOISTURE -> this.soilMoisture = v;
                case ILLUMINANCE -> this.illuminance = v;
                case CO2 -> this.co2 = v;
                case RAINFALL -> this.rainfall = v;
                default -> {
                    // 规范码已收敛，不可达
                }
            }
        }

        private EnvironmentDataVO toVO(Map<Long, String> plotNames) {
            EnvironmentDataVO vo = new EnvironmentDataVO();
            vo.setDataId(firstId == null ? null : String.valueOf(firstId));
            vo.setDeviceId(deviceId == null ? null : String.valueOf(deviceId));
            vo.setPlotId(plotId == null ? null : String.valueOf(plotId));
            vo.setPlotName(plotId == null ? null : plotNames.get(plotId));
            vo.setAirTemperature(airTemperature);
            vo.setAirHumidity(airHumidity);
            vo.setSoilTemperature(soilTemperature);
            vo.setSoilMoisture(soilMoisture);
            vo.setIlluminance(illuminance);
            vo.setCo2(co2);
            vo.setRainfall(rainfall);
            // 有设备号的按"物联网设备"计；没有设备号的长表行只能来自人工录入/导入
            vo.setSource(deviceId == null ? EnvironmentDataVO.SOURCE_MANUAL : EnvironmentDataVO.SOURCE_IOT);
            vo.setCollectedAt(dataTime == null ? null : DATETIME.format(dataTime));
            return vo;
        }
    }
}
