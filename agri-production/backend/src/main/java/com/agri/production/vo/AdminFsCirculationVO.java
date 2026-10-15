package com.agri.production.vo;

import com.agri.production.entity.CirculationAnomaly;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/**
 * 流通异常出参（页面 {@code CirculationRecord}）。
 *
 * <p>映射：{@code anomaly_id→id}、{@code found_time→foundAt}、{@code batch_no→batchNo}、
 * {@code product_name→product}、{@code anomaly_type→type}、{@code impact_range→impact}、
 * {@code found_date→foundDate}。页面按 {@code type/severity/status} 的英文字面量做筛选与展示，
 * 所以这三个字段原样透出（库里存的就是这套词表）。</p>
 */
@Data
public class AdminFsCirculationVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String id;
    /** 发现时间 */
    private String foundAt;
    private String batchNo;
    /** 产品名称 */
    private String product;
    /** temperature / overtime / label */
    private String type;
    /** severe / medium / minor */
    private String severity;
    /** 影响范围（页面直接显示，如 50kg） */
    private String impact;
    /** pending / processing / done */
    private String status;
    /** 发现日期 yyyy-MM-dd（页面的日期筛选按它比） */
    private String foundDate;
    private String measure;

    public static AdminFsCirculationVO of(CirculationAnomaly entity) {
        if (entity == null) {
            return null;
        }
        AdminFsCirculationVO vo = new AdminFsCirculationVO();
        vo.id = entity.getAnomalyId();
        vo.foundAt = entity.getFoundTime() == null ? null : DATE_TIME.format(entity.getFoundTime());
        vo.batchNo = entity.getBatchNo();
        vo.product = entity.getProductName();
        vo.type = entity.getAnomalyType();
        vo.severity = entity.getSeverity();
        vo.impact = entity.getImpactRange();
        vo.status = entity.getStatus();
        vo.foundDate = entity.getFoundDate() == null ? null : entity.getFoundDate().toString();
        vo.measure = entity.getMeasure();
        return vo;
    }
}
