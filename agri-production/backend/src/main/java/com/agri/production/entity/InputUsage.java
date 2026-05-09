package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_input_usage")
public class InputUsage {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("usage_no")
    private String usageNo;

    @TableField("product_id")
    private Long productId;

    @TableField("product_name")
    private String productName;

    @TableField("batch_no")
    private String batchNo;

    @TableField("outbound_id")
    private Long outboundId;

    @TableField("task_id")
    private Long taskId;

    @TableField("task_execution_id")
    private Long taskExecutionId;

    @TableField("plot_id")
    private Long plotId;

    @TableField("plot_name")
    private String plotName;

    @TableField("usage_date")
    private Date usageDate;

    @TableField("usage_quantity")
    private BigDecimal usageQuantity;

    @TableField("unit")
    private String unit;

    @TableField("usage_method")
    private String usageMethod;

    @TableField("dilution_ratio")
    private String dilutionRatio;

    @TableField("target_pest")
    private String targetPest;

    @TableField("weather_condition")
    private String weatherCondition;

    @TableField("wind_level")
    private String windLevel;

    @TableField("applicator")
    private String applicator;

    @TableField("pre_harvest_interval")
    private Integer preHarvestInterval;

    @TableField("safe_harvest_date")
    private Date safeHarvestDate;

    @TableField("harvest_locked")
    private Integer harvestLocked;

    @TableField("usage_result")
    private String usageResult;

    @TableField("effectiveness_evaluation")
    private String effectivenessEvaluation;

    @TableField("chain_status")
    private String chainStatus;

    @TableField("chain_tx_hash")
    private String chainTxHash;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;

    @TableField("update_by")
    private String updateBy;

    @TableField("update_time")
    private Date updateTime;
}