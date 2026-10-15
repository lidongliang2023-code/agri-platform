package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 监管报表任务（运维端「统计报表」）。
 *
 * <p>字段按页面契约 {@code ReportTask}（api/admin/reports.ts）定；业务编号出参名是 {@code reportId}
 * （与平台侧把业务编号作主键一致）。不继承 BaseEntity 的理由同
 * {@link KnowledgeArticle}：报表是平台级对象，没有农场维度。</p>
 */
@Data
@TableName("agri_prod_report_task")
public class ReportTask {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @JsonProperty("reportId")
    @TableField("report_code")
    private String reportCode;

    /** GOV 政务监管 / BIZ 经营 / QUALITY 质量 */
    @TableField("report_type")
    private String reportType;

    @TableField("report_name")
    private String reportName;

    @TableField("farm_id")
    private Long farmId;

    @TableField("biz_date_from")
    private LocalDate bizDateFrom;

    @TableField("biz_date_to")
    private LocalDate bizDateTo;

    @TableField("generator_id")
    private String generatorId;

    @TableField("file_url")
    private String fileUrl;

    @TableField("generated_at")
    private LocalDateTime generatedAt;

    /** PENDING / RUNNING / DONE / FAILED */
    @TableField("status")
    private String status;

    @TableField("tenant_id")
    private String tenantId;

    @JsonProperty("createdAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("create_time")
    private LocalDateTime createTime;

    @JsonProperty("updatedAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
