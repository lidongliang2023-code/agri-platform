package com.agri.produce.internal.iot;

import lombok.Data;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 环境趋势视图对象（多指标）。
 *
 * <p>环境读数在库内是<strong>窄表</strong>结构（{@code prod_iot_reading} 一行一个
 * {@code metric + metricValue}），并非「一行含 temperature/humidity 多列」的宽表。
 * 本 VO 负责把窄表按日期 × 指标透视成前端可直接画曲线的结构。</p>
 *
 * <p>{@code series} 的键为 snake_case 规范指标码（见 {@link IotReadingService#CANONICAL_METRICS}）；
 * 缺失点位用 {@code null} 占位（不补 0，避免伪造数据）。
 * {@code temperatures} 是 {@code series.air_temperature} 的别名，保留以兼容既有调用。</p>
 */
@Data
public class EnvTrendVO {

    /** 日期序列（yyyy-MM-dd，升序） */
    private List<String> dates;

    /** 指标 → 与 dates 等长的数值序列，缺失为 null */
    private Map<String, List<Double>> series;

    /** series.air_temperature 的别名（兼容既有单指标调用） */
    private List<Double> temperatures;

    /**
     * 构造空趋势（无数据时返回，避免前端判空）。
     *
     * @return 空 VO
     */
    public static EnvTrendVO empty() {
        EnvTrendVO vo = new EnvTrendVO();
        vo.setDates(Collections.emptyList());
        vo.setSeries(Collections.emptyMap());
        vo.setTemperatures(Collections.emptyList());
        return vo;
    }
}
