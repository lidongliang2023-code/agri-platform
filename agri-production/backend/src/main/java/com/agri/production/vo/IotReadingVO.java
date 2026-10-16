package com.agri.production.vo;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 设备读数出参（页面 IotReading）。
 *
 * <p>由 {@code agri_prod_sensor_data} 长表逐行转换而来（**不透视**：这两条端点要的就是一行一指标的窄表）。</p>
 *
 * <p>{@code metric} 给的是**规范 snake_case 指标码**（{@code air_temperature} 等）：
 * 页面 {@code normalizeMetric} 的别名表认这套写法，而库里存的 {@code sensor_type} 是
 * {@code temperature} 这类自由文本 —— 直接把库内原文抛给页面也能显示，但同一个指标在不同设备上
 * 会有多种写法（temperature / air_temperature / 空气温度），曲线就断成两条。</p>
 */
@Data
public class IotReadingVO {

    /** 读数 ID（长表主键的字符串形式；本服务没有单独的读数业务编号） */
    private String readingId;

    private String deviceId;

    private String deviceCode;

    private String plotId;

    /** 规范指标码，如 air_temperature */
    private String metric;

    private BigDecimal metricValue;

    private String unit;

    /** 采集时间（yyyy-MM-dd HH:mm:ss） */
    private String readTime;

    /** 数据质量标记：1 正常 0 异常（库内是 good/bad 这类文本，按词表映射） */
    private Integer qualityFlag;
}
