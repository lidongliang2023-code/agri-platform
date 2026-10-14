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
 * 成品库存流水（前端契约 {@code InventoryFlow}）。
 *
 * <p>{@code flowType}：1 入库 2 出库 3 调拨 4 损耗；{@code quantity} 带符号
 * （入库为正，出库/损耗/调拨出为负）——"流水加总 = 当前库存"这条对账关系靠它成立。</p>
 */
@Data
@TableName("agri_prod_inventory_flow")
public class InventoryFlow {

    @TableId(value = "id", type = IdType.AUTO)
    private Long flowId;

    @TableField("batch_id")
    private Long batchId;
    @TableField("flow_type")
    private Integer flowType;
    private BigDecimal quantity;
    private String unit;
    @TableField("operator_name")
    private String operatorName;
    @TableField("order_no")
    private String orderNo;

    @TableField("operated_at")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime operatedAt;

    private String remark;
    @TableField("warehouse_name")
    private String warehouseName;

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
