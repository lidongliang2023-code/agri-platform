package com.agri.production.vo;

import lombok.Data;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 环境趋势视图（页面 {@code EnvTrendVO}，成长曲线用）。
 *
 * <p>与前端 api 层声明的结构对齐：</p>
 * <ul>
 *   <li>{@code dates}：日期序列（yyyy-MM-dd，升序）；</li>
 *   <li>{@code series}：规范 snake_case 指标码 → 与 dates 等长的序列，缺失点位为 {@code null}
 *       （<b>不补 0</b>，否则曲线会把"没采到"画成"0"）；</li>
 *   <li>{@code temperatures}：{@code series.air_temperature} 的别名（兼容既有单指标调用，
 *       未请求该指标时给空数组而不是 null，免得前端 {@code .length} 直接炸）；</li>
 *   <li>{@code stats}：本段额外要求的口径 —— 每个指标当日聚合的 {@code min / avg / max / count}。
 *       曲线取 {@code avg}（series 里就是它），原始明细与极值在这里可查，
 *       而不是在同一个数组里塞多个值让调用方猜。</li>
 * </ul>
 */
@Data
public class EnvTrendVO {

    /** 日期序列（yyyy-MM-dd，升序） */
    private List<String> dates;

    /** 指标 → 与 dates 等长的序列（同日取均值），缺失为 null */
    private Map<String, List<Double>> series;

    /** series.air_temperature 的别名 */
    private List<Double> temperatures;

    /** 指标 → 每日聚合 {yyyy-MM-dd: {min, avg, max, count}} */
    private Map<String, Map<String, Map<String, Double>>> stats;

    public static EnvTrendVO empty() {
        EnvTrendVO vo = new EnvTrendVO();
        vo.dates = Collections.emptyList();
        vo.series = Collections.emptyMap();
        vo.temperatures = Collections.emptyList();
        vo.stats = new LinkedHashMap<>();
        return vo;
    }
}
