package com.agri.produce.internal.plot;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;

/**
 * 地块/棚（生产底册，溯源链路起点）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_plot_info")
public class PlotInfoEntity extends ProduceBaseEntity {

    @TableId(value = "plot_id", type = IdType.INPUT)
    private String plotId;

    /** 所属农场ID */
    private String farmId;

    /** 地块编码（租户内唯一） */
    private String plotCode;

    /** 地块名称 */
    private String plotName;

    /** 面积（亩） */
    private BigDecimal area;

    /** 种植方式 1露天 2大棚 3水田 4山地 */
    private Integer plantingType;

    /** 土壤类型 */
    private String soilType;

    /** 灌溉方式 */
    private String irrigationType;

    /** 当前作物ID */
    private String cropId;

    /** 当前品种 */
    private String cropVariety;

    /** 当前种养计划ID */
    private String currentPlanId;

    /** 地块边界 GeoJSON */
    private String geoBoundary;

    /** 状态 1空闲 2在种 3采收期 4休耕 0停用 */
    private Integer status;
}
