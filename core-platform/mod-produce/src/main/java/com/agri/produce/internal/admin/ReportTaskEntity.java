package com.agri.produce.internal.admin;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 监管/经营报表生成任务
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_report_task")
public class ReportTaskEntity extends ProduceBaseEntity {

    @TableId(value = "report_id", type = IdType.INPUT)
    private String reportId;

    /** 报表类型 GOV/BIZ/QUALITY */
    private String reportType;

    /** 报表名称 */
    private String reportName;

    /** 农场ID（空表示全量） */
    private String farmId;

    /** 统计起始日 */
    private LocalDate bizDateFrom;

    /** 统计截止日 */
    private LocalDate bizDateTo;

    /** 生成人 */
    private String generatorId;

    /** 报表文件 */
    private String fileUrl;

    /** 生成时间 */
    private LocalDateTime generatedAt;

    /** 状态 PENDING/RUNNING/DONE/FAILED */
    private String status;
}
