package com.agri.production.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产监控看板的「环境实时概览」。
 *
 * <p><b>为什么窗口要锚定在"最新一次采样"而不是"当前时间"</b>：
 * 设备离线、部署环境没有真实数据源时，`now - 24h` 会取到空集，页面上就是一片空白 ——
 * 而如果这时改去"取最后 N 条记录"，又会把上周的数据画成"近 24 小时"，
 * 用户完全看不出这是旧数据。所以这里把窗口锚定在 {@code latestAt}，
 * 同时把 {@link #staleHours}（最新采样距现在多少小时）一起返回，
 * 页面据此显示"数据截止 10-13 16:00（滞后 360 小时）"，宁可难看也不骗人。</p>
 */
@Data
public class MonitorEnvVO {

    /** 统计窗口长度（小时） */
    private int windowHours;

    /** 窗口起点（yyyy-MM-dd HH:mm:ss） */
    private String windowFrom;

    /** 窗口终点 = 最新一次采样时间（yyyy-MM-dd HH:mm:ss） */
    private String windowTo;

    /** 最新一次采样时间距现在的小时数；无数据时为 null */
    private Long staleHours;

    /** 参与聚合的读数条数（长表行数，不是宽表行数） */
    private int sampleCount;

    /** 覆盖的地块数量 */
    private int plotCount;

    /**
     * 指标平均值（规范码 → 值）：air_temperature / air_humidity / soil_temperature /
     * soil_moisture / illuminance / co2。没有该指标的数据时**不放这个键**，
     * 页面按"无数据"渲染，而不是显示一个 0。
     */
    private Map<String, Double> summary = new LinkedHashMap<>();

    /** 窗口内降雨累计（mm）；没有降雨数据时为 null（不补 0） */
    private Double rainfallTotal;

    /** 按小时聚合的曲线点（升序） */
    private List<Point> series = new ArrayList<>();

    /** 曲线点：一小时一个，指标缺失为 null */
    @Data
    public static class Point {
        /** 小时标签（MM-dd HH:00） */
        private String time;
        private Double airTemperature;
        private Double airHumidity;
        private Double soilTemperature;
        private Double soilMoisture;
        private Double illuminance;
        private Double co2;
    }

    /** 空结果（没有采样数据时用） */
    public static MonitorEnvVO empty(int windowHours) {
        MonitorEnvVO vo = new MonitorEnvVO();
        vo.windowHours = windowHours;
        vo.sampleCount = 0;
        vo.plotCount = 0;
        return vo;
    }
}
