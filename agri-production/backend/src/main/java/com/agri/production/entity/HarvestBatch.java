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
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 采收批次（前端契约 {@code @agri/shared/types/harvest} 的 {@code HarvestBatch}）。
 *
 * <p>字段名即契约名，物理列走 snake_case —— 与 TaskRecord / PlanStage / Inspection 同一口径。</p>
 *
 * <p>值域：{@code grade} A/B/C/D/reject/待检；{@code status} 1 在库 2 部分出库 3 清空 4 冻结 5 归档；
 * {@code inboundStatus} 0 待入库 1 已入库 2 已出库。</p>
 */
@Data
@TableName("agri_prod_harvest_batch")
public class HarvestBatch {

    @TableId(value = "id", type = IdType.AUTO)
    private Long batchId;

    @TableField("batch_no")
    private String batchNo;

    @TableField("plot_id")
    private Long plotId;
    @TableField("plot_name")
    private String plotName;
    @TableField("plan_id")
    private Long planId;
    @TableField("crop_id")
    private Long cropId;
    @TableField("crop_name")
    private String cropName;
    @TableField("crop_variety")
    private String cropVariety;

    @TableField("harvest_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate harvestDate;

    private BigDecimal quantity;
    private String unit;
    private String grade;

    @TableField("inspection_id")
    private Long inspectionId;
    @TableField("inspection_no")
    private String inspectionNo;
    @TableField("operator_id")
    private Long operatorId;
    @TableField("operator_name")
    private String operatorName;

    /** 1 在库 2 部分出库 3 清空 4 冻结 5 归档 */
    private Integer status;

    @TableField("trace_generated")
    private Integer traceGenerated;
    @TableField("trace_code")
    private String traceCode;
    @TableField("farm_id")
    private Long farmId;
    @TableField("farm_name")
    private String farmName;

    /** 0 待入库 1 已入库 2 已出库 */
    @TableField("inbound_status")
    private Integer inboundStatus;

    @TableField("harvest_area")
    private BigDecimal harvestArea;
    private String appearance;
    @TableField("expected_quantity")
    private BigDecimal expectedQuantity;
    @TableField("per_mu_yield")
    private BigDecimal perMuYield;
    @TableField("related_task_id")
    private Long relatedTaskId;
    @TableField("related_task_name")
    private String relatedTaskName;
    @TableField("warehouse_name")
    private String warehouseName;
    @TableField("inventory_id")
    private Long inventoryId;
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
