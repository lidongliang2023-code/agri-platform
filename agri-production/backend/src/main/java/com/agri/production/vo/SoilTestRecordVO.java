package com.agri.production.vo;

import com.agri.production.entity.SoilRecord;
import lombok.Data;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

/**
 * 土壤检测档案出参（页面 SoilTestRecord）。

 *
 * <p>出参名按页面契约（ph / organicMatter / totalNitrogen / availablePhosphorus / availablePotassium /
 * moisture），库里那几列仍叫 ph_value / organic_matter / nitrogen / phosphorus / potassium /
 * moisture_content —— 改列名会牵动这张表所有历史查询，所以在出参这一层换名。
 * 平台侧没有的项（testOrg / conductivity / conclusion / reportUrl）一律为空，不编。</p>
 */
@Data
public class SoilTestRecordVO {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String recordId;
    private String plotId;
    private String plotName;
    /** 检测日期 yyyy-MM-dd */
    private String testDate;
    private BigDecimal ph;
    /** 有机质 g/kg */
    private BigDecimal organicMatter;
    /** 全氮 g/kg */
    private BigDecimal totalNitrogen;
    /** 有效磷 mg/kg */
    private BigDecimal availablePhosphorus;
    /** 速效钾 mg/kg */
    private BigDecimal availablePotassium;
    /** 含水率 % */
    private BigDecimal moisture;
    /** 电导率（本部署无数据源） */
    private BigDecimal conductivity;
    /** 检测人 */
    private String tester;
    /** 检测机构（本部署无数据源） */
    private String testOrg;
    private String reportUrl;
    private String conclusion;
    private String remark;
    private String createdAt;

    public static SoilTestRecordVO of(SoilRecord entity, String plotName) {
        if (entity == null) {
            return null;
        }
        SoilTestRecordVO vo = new SoilTestRecordVO();
        vo.recordId = entity.getSoilId() != null ? entity.getSoilId()
                : (entity.getId() == null ? null : String.valueOf(entity.getId()));
        vo.plotId = entity.getPlotId() == null ? null : String.valueOf(entity.getPlotId());
        vo.plotName = plotName;
        vo.testDate = entity.getSampleDate() == null ? null : DATE.format(entity.getSampleDate());
        vo.ph = entity.getPhValue();
        vo.organicMatter = entity.getOrganicMatter();
        vo.totalNitrogen = entity.getNitrogen();
        vo.availablePhosphorus = entity.getPhosphorus();
        vo.availablePotassium = entity.getPotassium();
        vo.moisture = entity.getMoistureContent();
        vo.conductivity = entity.getConductivity();
        vo.tester = entity.getTester();
        vo.testOrg = entity.getTestOrg();
        vo.reportUrl = entity.getReportUrl();
        vo.conclusion = entity.getConclusion();
        vo.remark = entity.getRemark();
        vo.createdAt = entity.getCreateTime() == null ? null : DATETIME.format(entity.getCreateTime());
        return vo;
    }
}
