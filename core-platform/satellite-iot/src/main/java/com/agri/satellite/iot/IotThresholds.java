package com.agri.satellite.iot;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 阈值规则（本地规则联动，边缘网关承载断网续传与安全联动，图 4）。
 */
@Data
@Component
@ConfigurationProperties(prefix = "agri.iot")
public class IotThresholds {

    /** 指标 → 告警阈值（超过即告警；超过 1.2 倍升级 CRITICAL） */
    private Map<String, BigDecimal> thresholds = Map.of(
            "temperature", new BigDecimal("40"),
            "humidity", new BigDecimal("90"),
            "soil-moisture", new BigDecimal("20"),
            "co2", new BigDecimal("1500"));

    public BigDecimal forMetric(String metric) {
        return metric == null ? null : thresholds.get(metric);
    }
}
