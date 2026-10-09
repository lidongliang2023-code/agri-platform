package com.agri.produce.internal.ai;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * AI 诊断记录（病虫害/长势/成熟度识别）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_ai_diagnosis")
public class AiDiagnosisEntity extends ProduceBaseEntity {

    @TableId(value = "diagnosis_id", type = IdType.INPUT)
    private String diagnosisId;

    /** 地块ID */
    private String plotId;

    /** 作物ID */
    private String cropId;

    /** 作物名称 */
    private String cropName;

    /** 识别图片 */
    private String imageUrl;

    /** 诊断类型 PEST/GROWTH/MATURITY */
    private String diagnosisType;

    /** 识别结果 */
    private String resultLabel;

    /** 置信度(%) */
    private BigDecimal confidence;

    /** 处置建议 */
    private String suggestion;

    /** 模型名称 */
    private String modelName;

    /** 诊断时间 */
    private LocalDateTime diagnosedAt;

    /** 状态 PENDING/SUCCESS/FAILED */
    private String status;
}
