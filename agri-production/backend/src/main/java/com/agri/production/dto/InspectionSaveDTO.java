package com.agri.production.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 质量检测单新增 / 编辑入参（前端 {@code Partial<RawInspection>}）。
 *
 * <p>页面送检登记实际下发的字段（QualityInspection.tsx 的 submitCreate）：
 * inspectionNo / batchId / plotId / cropId / inspectionType / inspectorName / sampleQty /
 * sampleAt / reportUrl / status / labId / labName。</p>
 *
 * <p>两个地方刻意放宽：</p>
 * <ul>
 *   <li>关联 ID 全是 String —— 批次下拉给的是批次号或 ID 的字符串形式，用 Long 接会在
 *       反序列化阶段就失败（页面只表现为"提交不了"）；</li>
 *   <li>{@code sampleAt} 是 String —— 页面提交 ISO（带 T），别处可能是
 *       {@code yyyy-MM-dd HH:mm:ss}，两种都要收。</li>
 * </ul>
 */
@Data
public class InspectionSaveDTO {

    private String inspectionNo;

    private String batchId;
    private String batchNo;
    private String farmId;
    private String plotId;
    private String cropId;
    private String cropName;

    /** SELF / SEND / SAMPLING */
    private String inspectionType;

    private String inspectorId;
    private String inspectorName;

    private BigDecimal sampleQty;
    /** 抽样时间（ISO 或 yyyy-MM-dd HH:mm:ss） */
    private String sampleAt;

    /** PASS / FAIL */
    private String result;

    private String reportUrl;

    /** PENDING / TESTING / DONE */
    private String status;

    private String labId;
    private String labName;

    private Integer onChain;
    private String remark;
}
