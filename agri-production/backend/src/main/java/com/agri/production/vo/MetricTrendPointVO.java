package com.agri.production.vo;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 指标趋势点（页面 TrendPoint，由 production-adapter 归一）。
 *
 * <p>字段名刻意用后端实体口径（bizDate / metricValue）：前端的 production-adapter
 * 就是按这两个名字（外加 date / value 兼容位）读的，换个命名反而要多一层映射。</p>
 */
@Data
public class MetricTrendPointVO {

    /** 统计日期（yyyy-MM-dd） */
    private String bizDate;

    /** 指标值 */
    private BigDecimal metricValue;

    /** 指标编码（回显，便于同一张图上区分多条序列） */
    private String metricCode;
}
