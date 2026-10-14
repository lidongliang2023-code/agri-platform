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
 * 投入品库存流水（入库 / 领用 / 退回 / 盘盈 / 盘亏 / 报损）。
 *
 * <p>字段名按前端契约（{@code api/inputs.ts} 的 {@code InputStockFlow}）。</p>
 *
 * <p>{@code flowType}：1 入库 2 领用 3 退回 4 盘盈 5 盘亏 6 报损。
 * {@code qty} **带符号**（入库/退回为正，领用/盘亏/报损为负），
 * 这样"加总流水 = 当前库存"这条对账关系直接成立；库存字段只由这里改动，
 * 不允许别的入口直接写 {@code stock_qty}（否则流水与库存必然对不上）。</p>
 */
@Data
@TableName("agri_prod_input_stock_flow")
public class InputStockFlow {

    @TableId(value = "id", type = IdType.AUTO)
    private Long flowId;

    @TableField("input_id")
    private Long inputId;

    @TableField("warehouse_id")
    private Long warehouseId;

    /** 1 入库 2 领用 3 退回 4 盘盈 5 盘亏 6 报损 */
    @TableField("flow_type")
    private Integer flowType;

    /** 带符号数量：入库/退回/盘盈为正，领用/盘亏/报损为负 */
    @TableField("qty")
    private BigDecimal qty;

    @TableField("batch_no")
    private String batchNo;

    @TableField("expire_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate expireDate;

    @TableField("operator_id")
    private Long operatorId;

    @TableField("related_task_id")
    private Long relatedTaskId;

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
