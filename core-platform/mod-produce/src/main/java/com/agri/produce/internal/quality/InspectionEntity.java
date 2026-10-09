package com.agri.produce.internal.quality;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 质量检测（自检/送检/抽检）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_inspection")
public class InspectionEntity extends ProduceBaseEntity {

    @TableId(value = "inspection_id", type = IdType.INPUT)
    private String inspectionId;

    /** 检测单号（租户内唯一） */
    private String inspectionNo;

    /** 采收批次ID */
    private String batchId;

    /** 地块ID */
    private String plotId;

    /** 作物ID */
    private String cropId;

    /** 检测类型 SELF/SEND/SAMPLING */
    private String inspectionType;

    /** 检测人 */
    private String inspectorId;

    /** 检测人姓名 */
    private String inspectorName;

    /** 抽样数量 */
    private BigDecimal sampleQty;

    /** 抽样时间 */
    private LocalDateTime sampleAt;

    /** 结论 PASS/FAIL */
    private String result;

    /** 检测报告 */
    private String reportUrl;

    /** 状态 PENDING/TESTING/DONE */
    private String status;
}
