package com.agri.produce.internal.harvest;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 成品入库入参（工单 BT-02，前端 {@code StockInPayload}）。
 *
 * <p><b>为什么需要独立 DTO 而不是复用 {@link InventoryEntity}。</b>前端入库只传
 * {@code batchId / warehouseName / quantity / unit / locationCode / expireDate /
 * operatorName / remark} 八个字段，若直接拿实体接参，实体上的 {@code currentQty}
 * 等库存字段会一并被 Jackson 绑定进来 —— 调用方只要多传一个 {@code currentQty: 999999}
 * 就能把库存写成任意值。DTO 显式收窄入参边界，超出契约的字段一律不生效。
 */
@Data
public class InventoryStockInRequest {

    /** 关联批次ID，必填 */
    private String batchId;

    /** 仓库名称，必填 */
    private String warehouseName;

    /** 入库数量，必须 &gt; 0 */
    private BigDecimal quantity;

    /** 计量单位，缺省 kg */
    private String unit;

    /** 库位编号 */
    private String locationCode;

    /** 保质期至（yyyy-MM-dd） */
    private String expireDate;

    /** 操作人姓名（落库到流水 operator_name，不再静默丢弃） */
    private String operatorName;

    /** 备注 */
    private String remark;
}
