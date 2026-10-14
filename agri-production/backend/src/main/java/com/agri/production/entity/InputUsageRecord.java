package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 投入品使用记录。
 *
 * <p>字段名按前端契约（{@code @agri/shared/types/input} 的 {@code InputUsageRecord}）：
 * 用量字段是 {@code dosage}、施用方式是 {@code method} —— 页面直接读这两个名字，
 * 换成 quantity/usageMethod 页面就是空列。</p>
 *
 * <p>{@code farmId} 由服务端按 {@code plotId} 推导后回填（契约里的原话），
 * 这样列表能按农场筛选，而不是只能拿 plotId 硬显示。</p>
 */
@Data
@TableName("agri_prod_input_usage")
public class InputUsageRecord {

    @TableId(value = "id", type = IdType.AUTO)
    private Long usageId;

    @TableField("task_id")
    private Long taskId;

    @TableField("plot_id")
    private Long plotId;

    @TableField("farm_id")
    private Long farmId;

    @TableField("input_id")
    private Long inputId;

    @TableField("input_name")
    private String inputName;

    /** 用量 */
    @TableField("dosage")
    private BigDecimal dosage;

    @TableField("unit")
    private String unit;

    /** 施用方式，如 喷施 / 沟施 */
    @TableField("method")
    private String method;

    @TableField("operator_id")
    private Long operatorId;

    @TableField("used_at")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime usedAt;

    /** 安全间隔期（天）：登记时会从投入品档案带过来，收获前锁定靠它 */
    @TableField("safety_interval_days")
    private Integer safetyIntervalDays;

    /** 1 正常 / 0 作废 */
    @TableField("status")
    private Integer status;

    @TableField("remark")
    private String remark;

    @TableField("tenant_id")
    private String tenantId;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;

    @JsonProperty("createdAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("create_time")
    private LocalDateTime createTime;

    @JsonProperty("updatedAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("update_time")
    private LocalDateTime updateTime;
}
