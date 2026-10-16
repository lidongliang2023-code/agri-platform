package com.agri.production.vo;

import lombok.Data;

/**
 * 环境数据（<b>宽表视图</b>，页面 {@code EnvironmentData}）。
 *
 * <p>本服务的传感器读数在库里是**长表**（{@code agri_prod_sensor_data}：一行一个
 * {@code sensor_type + value + unit}），页面要的是**宽表**（一行同时含空气温湿度 / 土壤温湿度 /
 * 光照 / CO₂ / 降雨）。本 VO 是服务层把长表按「设备 + 地块 + 采集时刻」透视后的结果。</p>
 *
 * <p><b>缺采的指标一律留 null，不补 0</b>："没测到"与"测到 0"在农业上是两件事
 * （例如 0 ℃ 与"没有温度计"）。演示库目前只有 4 类指标，其余列就是 null ——
 * 页面会显示为"-"，这是真实状态。</p>
 */
@Data
public class EnvironmentDataVO {

    /** 数据来源：1 物联网设备 2 人工录入 3 气象站 */
    public static final Integer SOURCE_IOT = 1;
    public static final Integer SOURCE_MANUAL = 2;

    /** 数据 ID（透视后沿用该组第一条读数的库主键） */
    private String dataId;

    /** 地块标识（长表 plot_id 的字符串形式；本阶段是本地地块主键） */
    private String plotId;

    /** 地块名称（按本地地块档案补齐；查不到时为 null） */
    private String plotName;

    /** 设备标识（长表 device_id 的字符串形式） */
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

    /** 数据来源 1 物联网 2 人工 */
    private Integer source;

    /** 采集时间（yyyy-MM-dd HH:mm:ss，页面用 dayjs 解析） */
    private String collectedAt;
}
