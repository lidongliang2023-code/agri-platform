package com.agri.production.vo;

import com.agri.production.entity.AiDiagnosis;
import lombok.Data;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

/**
 * AI 诊断记录出参（页面 AiDiagnosisRecord）。

 *
 * <p>{@code confidence} 单位是**百分比**（92.50 = 92.5%），与页面类型的注释一致；
 * 本服务不产生诊断结论，字段值原样来自库内已有记录。</p>
 */
@Data
public class AiDiagnosisVO {

    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String diagnosisId;
    private String plotId;
    private String plotName;
    private String cropId;
    private String cropName;
    private String imageUrl;
    private String diagnosisType;
    private String resultLabel;
    /** 置信度（%） */
    private BigDecimal confidence;
    private String suggestion;
    private String modelName;
    private String status;
    private String diagnosedAt;

    public static AiDiagnosisVO of(AiDiagnosis entity, String plotName) {
        if (entity == null) {
            return null;
        }
        AiDiagnosisVO vo = new AiDiagnosisVO();
        vo.diagnosisId = entity.getDiagnosisId();
        vo.plotId = entity.getPlotId();
        vo.plotName = plotName;
        vo.cropId = entity.getCropId();
        vo.cropName = entity.getCropName();
        vo.imageUrl = entity.getImageUrl();
        vo.diagnosisType = entity.getDiagnosisType();
        vo.resultLabel = entity.getResultLabel();
        vo.confidence = entity.getConfidence();
        vo.suggestion = entity.getSuggestion();
        vo.modelName = entity.getModelName();
        vo.status = entity.getStatus();
        vo.diagnosedAt = entity.getDiagnosedAt() == null ? null : DATETIME.format(entity.getDiagnosedAt());
        return vo;
    }
}
