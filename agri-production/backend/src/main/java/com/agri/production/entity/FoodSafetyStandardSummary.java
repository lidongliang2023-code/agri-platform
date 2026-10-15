package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 食品安全-标准校验汇总（P17 Tab3 / 监控中心指标）。
 *
 * <p>汇总主键 {@code summary_id} 与业务键 {@code standard_no} 不是一个东西：表按 standard_no
 * 建了普通索引，理论上允许同一标准存多行历史。本服务与平台侧同口径 ——
 * 一个标准只有一行「当前汇总」，重算时原地更新，所以查询一律按 standard_no 取单行。</p>
 */
@Data
@TableName("agri_prod_fs_standard_summary")
public class FoodSafetyStandardSummary {

    @TableId(value = "summary_id", type = IdType.INPUT)
    private String summaryId;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("standard_no")
    private String standardNo;

    @TableField("batch_count")
    private Integer batchCount;

    @TableField("pass_count")
    private Integer passCount;

    @TableField("fail_count")
    private Integer failCount;

    /** 通过率（%），无批次时为 NULL */
    @TableField("pass_rate")
    private BigDecimal passRate;

    @TableField("last_run_time")
    private LocalDateTime lastRunTime;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
