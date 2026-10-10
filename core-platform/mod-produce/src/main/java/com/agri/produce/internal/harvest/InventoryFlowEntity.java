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

    /**
     * 操作人
     *
     * <p>与 {@link #operatorName} 并存：{@code operator_id} 是人员主键，
     * {@code operator_name} 是页面展示用姓名。BT-07 之前只收 {@code operatorId}，
     * 调用方传的 {@code operatorName} 既不落库也不报错（静默丢弃），本列即为修复。
     */
    private String operatorId;

    /** 操作人姓名（V14 新增，BT-07） */
    private String operatorName;

    /** 仓库名称（V14 新增，调拨/出库展示） */
    private String warehouseName;

    /** 关联交易单号 */
    private String relatedOrderNo;

    /** 备注 */
    private String remark;
}
