package com.agri.produce.internal.harvest;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 库存调拨入参（工单 BT-04，前端 {@code TransferPayload}）。
 *
 * <p>语义：{@code quantity} 从原库位台账扣、在目标仓库（+目标库位）台账加，
 * 并写成对的两条流水（原库位出库 {@code flowType=2} / 目标库位入库 {@code flowType=1}）。
 */
@Data
public class InventoryTransferRequest {

    /** 批次ID（路径变量，此处冗余一份用于校验一致性） */
    private String batchId;

    /** 目标仓库名称，必填 */
    private String targetWarehouse;

    /** 调拨数量，必须 &gt; 0 */
    private BigDecimal quantity;

    /** 目标库位编号 */
    private String locationCode;

    /** 备注 */
    private String remark;
}
