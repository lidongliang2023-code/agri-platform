package com.agri.produce.internal.harvest;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 采收、批次与库存（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/harvests")
@RequiredArgsConstructor
public class HarvestController {

    private final HarvestBatchService harvestBatchService;
    private final HarvestRecordService harvestRecordService;
    private final InventoryFlowService inventoryFlowService;

    @GetMapping
    public ApiResponse<PageResult<HarvestBatchEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                            @RequestParam(defaultValue = "10") long size,
                                                            @RequestParam(required = false) String keyword,
                                                            @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(harvestBatchService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<HarvestBatchEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(harvestBatchService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody HarvestBatchEntity entity) {
        return ApiResponse.ok(harvestBatchService.create(entity).getBatchId());
    }

    @PutMapping("/{id}")
    public ApiResponse<HarvestBatchEntity> update(@PathVariable String id, @RequestBody HarvestBatchEntity entity) {
        return ApiResponse.ok(harvestBatchService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        harvestBatchService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/records")
    public ApiResponse<PageResult<HarvestRecordEntity>> pageHarvestRecord(@RequestParam(defaultValue = "1") long page,
                                                                          @RequestParam(defaultValue = "10") long size,
                                                                          @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(harvestRecordService.page(page, size, status));
    }

    @GetMapping("/records/{id}")
    public ApiResponse<HarvestRecordEntity> detailHarvestRecord(@PathVariable String id) {
        return ApiResponse.ok(harvestRecordService.detail(id));
    }

    @PostMapping("/records")
    public ApiResponse<String> createHarvestRecord(@RequestBody HarvestRecordEntity entity) {
        return ApiResponse.ok(harvestRecordService.create(entity).getRecordId());
    }

    @PutMapping("/records/{id}")
    public ApiResponse<HarvestRecordEntity> updateHarvestRecord(@PathVariable String id, @RequestBody HarvestRecordEntity entity) {
        return ApiResponse.ok(harvestRecordService.update(id, entity));
    }

    @DeleteMapping("/records/{id}")
    public ApiResponse<Void> deleteHarvestRecord(@PathVariable String id) {
        harvestRecordService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/{batchId}/flows")
    public ApiResponse<PageResult<InventoryFlowEntity>> pageInventoryFlow(@RequestParam(defaultValue = "1") long page,
                                                                          @RequestParam(defaultValue = "10") long size) {
        return ApiResponse.ok(inventoryFlowService.page(page, size));
    }

    @GetMapping("/{batchId}/flows/{id}")
    public ApiResponse<InventoryFlowEntity> detailInventoryFlow(@PathVariable String id) {
        return ApiResponse.ok(inventoryFlowService.detail(id));
    }

    @PostMapping("/{batchId}/flows")
    public ApiResponse<String> createInventoryFlow(@RequestBody InventoryFlowEntity entity) {
        return ApiResponse.ok(inventoryFlowService.create(entity).getFlowId());
    }

    @PutMapping("/{batchId}/flows/{id}")
    public ApiResponse<InventoryFlowEntity> updateInventoryFlow(@PathVariable String id, @RequestBody InventoryFlowEntity entity) {
        return ApiResponse.ok(inventoryFlowService.update(id, entity));
    }

    @DeleteMapping("/{batchId}/flows/{id}")
    public ApiResponse<Void> deleteInventoryFlow(@PathVariable String id) {
        inventoryFlowService.delete(id);
        return ApiResponse.ok();
    }

    /** 生成采收批次 */
    @PostMapping("/generate")
    public ApiResponse<HarvestBatchEntity> generate(@RequestBody HarvestBatchEntity batch) {
        return ApiResponse.ok(harvestBatchService.generate(batch));
    }

    /** 冻结批次 */
    @PostMapping("/{batchId}/freeze")
    public ApiResponse<HarvestBatchEntity> freeze(@PathVariable String batchId) {
        return ApiResponse.ok(harvestBatchService.freeze(batchId));
    }

    /** 归档批次 */
    @PostMapping("/{batchId}/archive")
    public ApiResponse<HarvestBatchEntity> archive(@PathVariable String batchId) {
        return ApiResponse.ok(harvestBatchService.archive(batchId));
    }

    /** 挂载检测结论 */
    @PostMapping("/{batchId}/bind-inspection")
    public ApiResponse<HarvestBatchEntity> bindInspection(@PathVariable String batchId,
                                                          @RequestParam String inspectionId,
                                                          @RequestParam(required = false) String grade) {
        return ApiResponse.ok(harvestBatchService.bindInspection(batchId, inspectionId, grade));
    }

    /** 地块采收汇总 */
    @GetMapping("/records/summary")
    public ApiResponse<Map<String, Object>> recordSummary(@RequestParam String plotId) {
        return ApiResponse.ok(harvestRecordService.sumByPlot(plotId));
    }

    /** 批次出库 */
    @PostMapping("/{batchId}/outbound")
    public ApiResponse<InventoryFlowEntity> outbound(@PathVariable String batchId,
                                                     @RequestParam BigDecimal qty,
                                                     @RequestParam(required = false) String operatorId,
                                                     @RequestParam(required = false) String relatedOrderNo) {
        return ApiResponse.ok(inventoryFlowService.outbound(batchId, qty, operatorId, relatedOrderNo));
    }

    /** 采收计划（按地块聚合采收记录） */
    @GetMapping("/plan")
    public ApiResponse<List<HarvestRecordEntity>> plan(@RequestParam(required = false) String plotId) {
        return ApiResponse.ok(harvestRecordService.listByPlot(plotId == null ? "" : plotId));
    }

    /** 库存流水总览 */
    @GetMapping("/inventory")
    public ApiResponse<List<InventoryFlowEntity>> inventory(@RequestParam(required = false) String batchId) {
        return ApiResponse.ok(inventoryFlowService.listByBatch(batchId == null ? "" : batchId));
    }

    /** 批次出库 */
    @PostMapping("/inventory/{batchId}/out")
    public ApiResponse<InventoryFlowEntity> inventoryOut(@PathVariable String batchId,
                                                         @RequestParam BigDecimal qty,
                                                         @RequestParam(required = false) String operatorId,
                                                         @RequestParam(required = false) String relatedOrderNo) {
        return ApiResponse.ok(inventoryFlowService.outbound(batchId, qty, operatorId, relatedOrderNo));
    }

    /** 批次冻结 */
    @PostMapping("/inventory/{batchId}/freeze")
    public ApiResponse<HarvestBatchEntity> inventoryFreeze(@PathVariable String batchId) {
        return ApiResponse.ok(harvestBatchService.freeze(batchId));
    }
}
