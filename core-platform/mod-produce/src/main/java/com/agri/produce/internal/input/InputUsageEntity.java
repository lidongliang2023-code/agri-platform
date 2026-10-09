package com.agri.produce.internal.input;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 投入品使用记录（农事任务落地，溯源关键证据）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_input_usage")
public class InputUsageEntity extends ProduceBaseEntity {

    @TableId(value = "usage_id", type = IdType.INPUT)
    private String usageId;

    /** 农事任务ID */
    private String taskId;

    /** 地块ID */
    private String plotId;

    /**
     * 所属农场ID（V10 补列 prod_input_usage.farm_id）。
     *
     * <p>前端 {@code src/api/inputs.ts createUsage} 的入参里没有 farmId，
     * 故新增时由服务端用 {@code plotId} 反查 {@code prod_plot_info.farm_id} 兜底填充
     * （见 {@code InputUsageService#create}）；推导不到（未挂地块或地块已删除）保持 null，
     * 不报错、不猜、不填占位值。</p>
     */
    private String farmId;

    /** 投入品ID */
    private String inputId;

    /** 投入品名称 */
    private String inputName;

    /** 投入品批次号（农药/肥料批号，溯源关键） */
    private String batchNo;

    /** 用量 */
    private BigDecimal dosage;

    /** 单位 */
    private String unit;

    /** 施用方式 */
    private String method;

    /** 操作人 */
    private String operatorId;

    /** 使用时间 */
    private LocalDateTime usedAt;

    /** 安全间隔期（天） */
    private Integer safetyIntervalDays;

    /** 状态 1正常 0作废 */
    private Integer status;
}
