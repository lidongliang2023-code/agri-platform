package com.agri.production.vo;

import com.agri.production.entity.FoodSafetyStandardSummary;
import lombok.Data;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

/**
 * 标准校验汇总出参（页面 {@code StandardCheckSummary}）。
 *
 * <p>{@code passRate} 允许为 null，语义是「该标准一批都没抽到」—— 不是 0%。
 * 页面按 {@code MetricStatistic} 渲染「—」，所以这里不能把 null 兜成 0。</p>
 */
@Data
public class AdminFsStandardSummaryVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String summaryId;
    private String standardNo;
    private Integer batchCount;
    private Integer passCount;
    private Integer failCount;
    /** 通过率（%），可为 null */
    private BigDecimal passRate;
    private String lastRunTime;

    public static AdminFsStandardSummaryVO of(FoodSafetyStandardSummary entity) {
        if (entity == null) {
            return null;
        }
        AdminFsStandardSummaryVO vo = new AdminFsStandardSummaryVO();
        vo.summaryId = entity.getSummaryId();
        vo.standardNo = entity.getStandardNo();
        vo.batchCount = entity.getBatchCount();
        vo.passCount = entity.getPassCount();
        vo.failCount = entity.getFailCount();
        vo.passRate = entity.getPassRate();
        vo.lastRunTime = entity.getLastRunTime() == null ? null : DATE_TIME.format(entity.getLastRunTime());
        return vo;
    }
}
