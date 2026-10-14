package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inventory;
import com.agri.production.entity.InventoryFlow;

import java.util.List;
import java.util.Map;

/**
 * 采收批次与成品库存。
 *
 * <p>两条纪律：</p>
 * <ul>
 *   <li><b>库存在库里只有一个真源</b>：{@code current_qty} 的每次增减都紧跟一行 inventory_flow，
 *       否则"流水加总 = 当前库存"当场失守；</li>
 *   <li><b>批次的入库状态由库存动作推导</b>（入库 → 1 已入库，全量出库 → 2 已出库），
 *       不让人手工填 —— 手工填就会出现"库存有货但批次写着待入库"。</li>
 * </ul>
 */
public interface IHarvestInventoryService {

    /* ---------- 采收批次 ---------- */

    PageResult<HarvestBatch> pageBatches(int pageNum, int pageSize, Long farmId, Long plotId, Long cropId,
                                        String batchNo, String grade, Integer status, Integer inboundStatus,
                                        String startDate, String endDate, String tenantId);

    HarvestBatch detailBatch(Long batchId, String tenantId);

    HarvestBatch createBatch(Map<String, Object> body, String tenantId);

    HarvestBatch updateBatch(Long batchId, Map<String, Object> body, String tenantId);

    void deleteBatch(Long batchId, String tenantId);

    /** 生成批次 / 溯源码（HARV-03），并把 traceGenerated 置 1。 */
    HarvestBatch generateBatch(Long batchId, Map<String, Object> body, String tenantId);

    /** 批次库存在流水（前端库存详情读它）。 */
    PageResult<InventoryFlow> pageBatchFlows(Long batchId, int pageNum, int pageSize, String tenantId);

    /** 按地块聚合已发生的采收记录（前端"地块采收记录"页；数据源是采收记录表）。 */
    PageResult<Map<String, Object>> pagePlotHarvestRecords(Long plotId, int pageNum, int pageSize, String tenantId);

    /* ---------- 成品库存 ---------- */

    PageResult<Inventory> pageInventory(int pageNum, int pageSize, String batchNo, String warehouseName,
                                       String category, String keyword, String healthStatus, String tenantId);

    Inventory detailInventory(Long inventoryId, String tenantId);

    Inventory createInventory(Map<String, Object> body, String tenantId);

    Inventory updateInventory(Long inventoryId, Map<String, Object> body, String tenantId);

    void deleteInventory(Long inventoryId, String tenantId);

    /** 成品入库（HARV-05）：数量累加 + 写一条 flowType=1 流水。 */
    boolean stockIn(Map<String, Object> body, String tenantId);

    /** 出库（HARV-06）：扣减 + flowType=2 流水，库存不足直接拒绝。 */
    InventoryFlow stockOut(Long batchId, java.math.BigDecimal qty, String relatedOrderNo,
                           String operatorName, String tenantId);

    /** 冻结：冻结量 = 当前量，批次状态置 4（冻结）。 */
    HarvestBatch freeze(Long batchId, String tenantId);

    /** 损耗登记（HARV-09）：扣减 + flowType=4 流水，同时累计 lossQty/lossReason。 */
    boolean registerLoss(Long batchId, Map<String, Object> body, String tenantId);

    /** 调拨：源仓扣减、目标仓累加，写一条 flowType=3 流水。 */
    boolean transfer(Long batchId, Map<String, Object> body, String tenantId);

    /** 某批次的库存记录（多仓时取第一条，用于出库/冻结/损耗的定位）。 */
    List<Inventory> inventoryByBatch(Long batchId, String tenantId);
}
