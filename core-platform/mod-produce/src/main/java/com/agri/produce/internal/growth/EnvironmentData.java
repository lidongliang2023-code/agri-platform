package com.agri.produce.internal.growth;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 环境数据（<b>宽表视图</b>）。
 *
 * <p>库内 {@code prod_iot_reading} 是<strong>窄表</strong>（一行一个 {@code metric + metricValue}），
 * 而前端 {@code types/growth.ts#EnvironmentData} 是<strong>宽表</strong>（一行同时含温度/湿度/光照等列）。
 * 本 VO 即后端把窄表按「设备 + 地块 + 采集时刻」透视成宽表后的结果，
 * 缺采的指标一律留 {@code null}——<b>不补 0</b>，避免把「没采到」伪装成「测到 0」。</p>
 *
 * <p>字段与前端 {@code EnvironmentData} 逐字段对齐。</p>
 */
@Data
public class EnvironmentData {

    /** 数据来源：1 物联网设备 2 人工录入 3 气象站 */
    public static final Integer SOURCE_IOT = 1;
    public static final Integer SOURCE_MANUAL = 2;
    public static final Integer SOURCE_WEATHER_STATION = 3;

    /** 数据 ID（透视后沿用该组第一条读数的业务主键） */
    private String dataId;

    /** 地块 ID */
    private String plotId;

    /** 地块名称（冗余）；窄表无此列，未关联地块档案时为 null */
    private String plotName;

    /** 设备 ID */
    private String deviceId;

    /** 空气温度（℃） */
    private Double airTemperature;

    /** 空气湿度（%） */
    private Double airHumidity;

    /** 土壤温度（℃） */
    private Double soilTemperature;

    /** 土壤湿度（%） */
    private Double soilMoisture;

    /** 光照强度（lux） */
    private Double illuminance;

    /** 二氧化碳浓度（ppm） */
    private Double co2;

    /** 降雨量（mm） */
    private Double rainfall;

    /** 数据来源 1物联网 2人工 3气象站 */
    private Integer source;

    /** 采集时间 */
    private LocalDateTime collectedAt;
}
