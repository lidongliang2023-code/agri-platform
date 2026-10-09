package com.agri.produce.internal.growth;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 作物生长监测记录（株高/叶片/病虫害/气象）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_growth_record")
public class GrowthRecordEntity extends ProduceBaseEntity {

    @TableId(value = "record_id", type = IdType.INPUT)
    private String recordId;

    /** 地块ID */
    private String plotId;

    /** 计划ID */
    private String planId;

    /** 批次ID */
    private String batchId;

    /** 作物ID */
    private String cropId;

    /** 生育期 苗期/花期/果期/成熟期 */
    private String growthStage;

    /** 记录日期 */
    private LocalDate recordDate;

    /** 株高(cm) */
    private BigDecimal height;

    /** 叶片数 */
    private Integer leafCount;

    /** 病虫害等级 0无 1轻 2中 3重 */
    private Integer pestLevel;

    /** 天气 */
    private String weather;

    /** 现场照片（JSON 数组） */
    private String photos;

    /** 记录人 */
    private String recorderId;

    /** 备注 */
    private String remark;

    /** 状态 1有效 0作废 */
    private Integer status;
}
