package com.agri.produce.internal.plot;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 地块土壤检测记录
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_plot_soil")
public class PlotSoilEntity extends ProduceBaseEntity {

    @TableId(value = "soil_id", type = IdType.INPUT)
    private String soilId;

    /** 地块ID */
    private String plotId;

    /** 采样日期 */
    private LocalDate sampleDate;

    /** pH 值 */
    private BigDecimal ph;

    /** 有机质(g/kg) */
    private BigDecimal organicMatter;

    /** 碱解氮(mg/kg) */
    private BigDecimal nitrogen;

    /** 有效磷(mg/kg) */
    private BigDecimal phosphorus;

    /** 速效钾(mg/kg) */
    private BigDecimal potassium;

    /** 含水率(%) */
    private BigDecimal moisture;

    /** 含盐量(g/kg) */
    private BigDecimal salinity;

    /** 检测人 */
    private String tester;

    /** 备注 */
    private String remark;
}
