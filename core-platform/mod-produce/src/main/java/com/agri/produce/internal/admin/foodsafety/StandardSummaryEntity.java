package com.agri.produce.internal.admin.foodsafety;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 行业标准校验汇总（P17 Tab3 批次级通过率）。
 *
 * <p>P15 的「合规校验通过率」由本表所有标准的 {@code pass_count / batch_count} 汇总派生，
 * 与 Tab3 页面同源，避免同一指标出现两个口径。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_fs_standard_summary")
public class StandardSummaryEntity extends ProduceBaseEntity {

    /** 汇总主键 */
    @TableId(value = "summary_id", type = IdType.INPUT)
    private String summaryId;

    /** 标准编号 */
    private String standardNo;

    /** 校验批次总数 */
    private Integer batchCount;

    /** 通过批次数 */
    private Integer passCount;

    /** 不通过批次数 */
    private Integer failCount;

    /** 通过率（%） */
    private BigDecimal passRate;

    /** 最近一次校验执行时间 */
    private LocalDateTime lastRunTime;
}
