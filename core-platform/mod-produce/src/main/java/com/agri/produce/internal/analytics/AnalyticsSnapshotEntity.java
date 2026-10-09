package com.agri.produce.internal.analytics;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 分析指标快照（产量/成本/达标率，T+1 汇聚）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_analytics_snapshot")
public class AnalyticsSnapshotEntity extends ProduceBaseEntity {

    @TableId(value = "snapshot_id", type = IdType.INPUT)
    private String snapshotId;

    /** 农场ID */
    private String farmId;

    /** 地块ID */
    private String plotId;

    /** 业务日期 */
    private LocalDate bizDate;

    /** 指标编码 YIELD/COST/PASS_RATE */
    private String metricCode;

    /** 指标名称 */
    private String metricName;

    /** 指标值 */
    private BigDecimal metricValue;

    /** 单位 */
    private String unit;

    /** 维度类型 FARM/PLOT/CROP */
    private String dimType;

    /** 维度值 */
    private String dimValue;

    /** 状态 1有效 0失效 */
    private Integer status;
}
