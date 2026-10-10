package com.agri.produce.internal.harvest;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 库存写操作结果视图（入库 / 报损 / 调拨共用）。
 *
 * <p><b>为什么写操作不能只返回 {@code boolean}。</b>此前
 * {@code POST /harvests/inventory/in} 返回 {@code ApiResponse<Boolean>}，恒为
 * {@code true}。调用方（含验收脚本）看到的永远是「成功」，无法判断库存到底加没加、
 * 加到了哪一行、加完之后是多少 —— 这正是 BT-02「静默假成功」能被当成真成功上线的原因：
 * 入库实际新造了一条台账而不是累加到已有台账，但响应体仍然报 {@code code=0 / data=true}。
 *
 * <p>本视图把「改的是哪一行、改前多少、改后多少、是新建还是累加」全部回传，
 * 使调用方可以做「调用 → 回读 → 比对」的闭环验证，不需要再靠响应体自证。
 */
@Data
public class InventoryOperationResult {

    /** 发生变动的台账主键（调拨时为**源**台账） */
    private String inventoryId;

    /** 批次ID */
    private String batchId;

    /** 仓库名称（调拨时为源仓库） */
    private String warehouseName;

    /** 库位编号，未指定时为 null */
    private String locationCode;

    /** 变动前库存 */
    private BigDecimal beforeQty;

    /** 变动量：入库为正，报损 / 调拨出库侧为负 */
    private BigDecimal deltaQty;

    /** 变动后库存（即台账当前 currentQty，回读比对就比这个） */
    private BigDecimal currentQty;

    /** 计量单位 */
    private String unit;

    /** 本次是否新建了台账：true 表示新建行，false 表示在已有行上累加 */
    private boolean ledgerCreated;

    /** 本次写入的流水号 */
    private String flowId;

    /** 调拨目标台账主键，非调拨为 null */
    private String targetInventoryId;

    /** 调拨目标仓库，非调拨为 null */
    private String targetWarehouseName;

    /** 调拨目标变动前库存，非调拨为 null */
    private BigDecimal targetBeforeQty;

    /** 调拨目标变动后库存，非调拨为 null */
    private BigDecimal targetCurrentQty;

    /** 调拨目标侧是否新建台账 */
    private boolean targetLedgerCreated;

    /** 调拨目标侧流水号 */
    private String targetFlowId;

    /**
     * 构造主台账侧结果。
     *
     * @param ledger   变动后的台账
     * @param beforeQty 变动前库存
     * @param deltaQty  变动量（正增负减）
     * @param flowId    流水号
     * @param created   是否新建台账
     * @return 结果视图
     */
    public static InventoryOperationResult of(InventoryEntity ledger, BigDecimal beforeQty,
                                              BigDecimal deltaQty, String flowId, boolean created) {
        InventoryOperationResult result = new InventoryOperationResult();
        result.setInventoryId(ledger.getInventoryId());
        result.setBatchId(ledger.getBatchId());
        result.setWarehouseName(ledger.getWarehouseName());
        result.setLocationCode(ledger.getLocationCode());
        result.setBeforeQty(beforeQty);
        result.setDeltaQty(deltaQty);
        result.setCurrentQty(ledger.getCurrentQty());
        result.setUnit(ledger.getUnit());
        result.setLedgerCreated(created);
        result.setFlowId(flowId);
        return result;
    }
}
