package com.agri.production.vo;

import com.agri.production.entity.ProductionReport;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/**
 * 生产报表出参（页面 ReportItem）。
 *
 * <p>出参名按页面契约：reportId / reportName / reportType / period / generatedAt / fileUrl /
 * fileSize / status。额外给出 periodStart / periodEnd（方案文档要的区间）—— 页面不读它，
 * 但让"这个周期到底是哪几天"在接口上可核。</p>
 *
 * <p>generatorName 恒为空：本服务只拿得到平台令牌对应的主体（租户），平台没有"当前用户档案"
 * 这类端点（/auth/me 不存在），绑定信息里只有 userId。把 19 位 userId 当姓名显示比留空更具误导性。</p>
 */
@Data
public class ReportVO {

    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private String reportId;
    private String reportName;
    /** 1 日报 2 周报 3 月报 4 季报 5 年报 */
    private Integer reportType;
    /** 周期标签，如 2026-03 */
    private String period;
    private String periodStart;
    private String periodEnd;
    /** yyyy-MM-dd HH:mm:ss */
    private String generatedAt;
    /** 生成人姓名（见类注释：本服务暂无来源，恒为空） */
    private String generatorName;
    private String fileUrl;
    private Long fileSize;
    /** 1 生成中 2 已完成 3 失败 */
    private Integer status;

    public static ReportVO of(ProductionReport entity) {
        if (entity == null) {
            return null;
        }
        ReportVO vo = new ReportVO();
        vo.reportId = entity.getReportId();
        vo.reportName = entity.getReportName();
        vo.reportType = entity.getReportType();
        vo.period = entity.getPeriod();
        vo.periodStart = entity.getPeriodStart() == null ? null : DATE.format(entity.getPeriodStart());
        vo.periodEnd = entity.getPeriodEnd() == null ? null : DATE.format(entity.getPeriodEnd());
        vo.generatedAt = entity.getGeneratedAt() == null ? null : DATETIME.format(entity.getGeneratedAt());
        vo.generatorName = entity.getGeneratedBy();
        vo.fileUrl = entity.getFileUrl();
        vo.fileSize = entity.getFileSize();
        vo.status = entity.getStatus();
        return vo;
    }
}
