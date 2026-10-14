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
 * 成品库存（前端契约 {@code InventoryRecord}）。
 *
 * <p>{@code healthStatus} 由服务层按 {@code currentQty / safeQty / expireDate} 现算，
 * 不是表列（库存是否健康是派生量，存下来就会和当前数量脱节）。</p>
 */
@Data
@TableName("agri_prod_inventory")
public class Inventory {

    @TableId(value = "id", type = IdType.AUTO)
    private Long inventoryId;

    @TableField("batch_id")
    private Long batchId;
    @TableField("batch_no")
    private String batchNo;
    @TableField("warehouse_name")
    private String warehouseName;
    @TableField("current_qty")
    private BigDecimal currentQty;
    private String unit;
    @TableField("frozen_qty")
    private BigDecimal frozenQty;
    @TableField("location_code")
    private String locationCode;

    @TableField("last_in_at")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime lastInAt;
    @TableField("last_out_at")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime lastOutAt;

    @TableField("product_name")
    private String productName;
    private String category;
    private String grade;
    @TableField("safe_qty")
    private BigDecimal safeQty;

    @TableField("expire_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate expireDate;

    @TableField("related_batch_no")
    private String relatedBatchNo;
    @TableField("loss_qty")
    private BigDecimal lossQty;
    @TableField("loss_reason")
    private String lossReason;

    /** 1 冻结 / 0 正常 */
    private Integer frozen;

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

    /** 库存健康状态（派生，不落库）：normal / warning / shortage / expiring */
    @TableField(exist = false)
    private String healthStatus;

    /** 是否冻结（派生的布尔视图，前端契约是 boolean） */
    @TableField(exist = false)
    private Boolean frozenFlag;
}
