package com.agri.produce.internal.harvest;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 损耗登记入参（工单 BT-03，前端 {@code LossPayload}）。
 *
 * <p>语义：出库型流水 {@code flowType=4}，数量为负，同时扣减台账当前库存并累加
 * {@code lossQty}。数量不得超过该批次的当前可用库存 —— 超了就报错，不允许把库存记成负数。
 */
@Data
public class InventoryLossRequest {

    /** 批次ID（路径变量，此处冗余一份用于校验一致性） */
    private String batchId;

    /** 损耗数量，必须 &gt; 0 */
    private BigDecimal quantity;

    /** 损耗原因 */
    private String reason;

    /** 操作人姓名（落库到流水 operator_name） */
    private String operatorName;

    /** 备注 */
    private String remark;
}
