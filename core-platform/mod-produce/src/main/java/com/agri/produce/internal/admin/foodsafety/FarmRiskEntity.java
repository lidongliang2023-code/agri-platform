package com.agri.produce.internal.admin.foodsafety;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 农场食品安全风险评分（P15 热力图）。
 *
 * <p>按 {@code stat_date} 分期存放：当期取库内最新统计月，环比由上一统计月派生。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_fs_farm_risk")
public class FarmRiskEntity extends ProduceBaseEntity {

    /** 评分记录主键（内部使用） */
    @TableId(value = "risk_id", type = IdType.INPUT)
    private String riskId;

    /** 农场ID（引用 prod_farm_info.farm_id） */
    private String farmId;

    /** 农场名称 */
    private String farmName;

    /** 食品安全评分 0~100：≥80 绿 / 60-80 黄 / <60 红 */
    private BigDecimal score;

    /** 统计日期（每月 1 日为锚点） */
    private LocalDate statDate;
}
