package com.agri.produce.internal.harvest;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;

/**
 * 批次库存流水（出入库/盘点/损耗）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_inventory_flow")
public class InventoryFlowEntity extends ProduceBaseEntity {

    @TableId(value = "flow_id", type = IdType.INPUT)
    private String flowId;

    /** 采收批次ID */
    private String batchId;

    /** 仓库ID */
    private String warehouseId;

    /** 类型 1入库 2出库 3盘点 4损耗 */
    private Integer flowType;

    /** 变动数量（出库为负） */
    private BigDecimal qty;

    /** 单位 */
    private String unit;

    /** 变动前库存 */
    private BigDecimal beforeQty;

    /** 变动后库存 */
    private BigDecimal afterQty;

    /** 操作人 */
    private String operatorId;

    /** 关联交易单号 */
    private String relatedOrderNo;

    /** 备注 */
    private String remark;
}
