package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inventory;
import com.agri.production.entity.InventoryFlow;
import com.agri.production.service.IHarvestInventoryService;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 采收批次与成品库存（前端 {@code api/harvests.ts}，BASE = {@code /api/v1/production/harvests}）。
 *
 * <p>这个控制器替换掉旧的 HarvestController：旧的是另一套形状（harvest_code / expected_quantity /
 * actual_quantity / quality_grade / harvest_team…），而且没有 /plan、/inventory、/{id}/flows、
 * /{id}/generate 这些页面真正调的路径。同一个路径下两个控制器会让 {@code GET /harvests}
 * 映射冲突、应用起不来，所以是替换。</p>
 *
 * <p><b>字面量路径先于 {@code /{batchId}} 匹配</b>：{@code /harvests/plan}、{@code /harvests/inventory}
 * 都是字面量，Spring 优先命中；否则会被 {@code /{batchId}} 接走并因 Long 转换失败报 400
 * （本仓库已经在 /inputs/stock、/plots/stats 上踩过两次同类坑）。</p>
 */
@RestController
@RequestMapping("/api/v1/production/harvests")
public class HarvestController {

    private final IHarvestInventoryService service;

    public HarvestController(IHarvestInventoryService service) {
        this.service = service;
    }

    /* ==================== 采收批次 ==================== */

    /** 分页查询采收批次。 */
    @GetMapping
    public ApiResponse<PageResult<HarvestBatch>> pageBatches(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String farmId,
            @RequestParam(required = false) String plotId,
            @RequestParam(required = false) String cropId,
            @RequestParam(required = false) String batchNo,
            @RequestParam(required = false) String grade,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) Integer inboundStatus,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        return ApiResponse.success(service.pageBatches(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                toLong(farmId), toLong(plotId), toLong(cropId), batchNo, grade, status, inboundStatus,
                startDate, endDate, TenantContextService.currentTenantId()));
    }

    /** 按地块聚合已发生的采收记录（页面「地块采收记录」）。 */
    @GetMapping("/plan")
    public ApiResponse<PageResult<Map<String, Object>>> pagePlotRecords(
            @RequestParam(required = false) String plotId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize) {
        return ApiResponse.success(service.pagePlotHarvestRecords(
                toLong(plotId), firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                TenantContextService.currentTenantId()));
    }

    /** 新增采收批次，返回新批次 ID。 */
    @PostMapping
    public ApiResponse<String> createBatch(@RequestBody Map<String, Object> body) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(String.valueOf(service.createBatch(body, tenantId).getBatchId()));
    }

    /** 批次详情。 */
    @GetMapping("/{batchId}")
    public ApiResponse<HarvestBatch> detailBatch(@PathVariable Long batchId) {
        return ApiResponse.success(service.detailBatch(batchId, TenantContextService.currentTenantId()));
    }

    /** 编辑批次。 */
    @PutMapping("/{batchId}")
    public ApiResponse<HarvestBatch> updateBatch(@PathVariable Long batchId, @RequestBody Map<String, Object> body) {
        return ApiResponse.success(service.updateBatch(batchId, body, TenantContextService.currentTenantId()));
    }

    /** 删除批次（逻辑删除）。 */
    @DeleteMapping("/{batchId}")
    public ApiResponse<Void> deleteBatch(@PathVariable Long batchId) {
        service.deleteBatch(batchId, TenantContextService.currentTenantId());
        return ApiResponse.success();
    }

    /** 生成批次 / 溯源码（HARV-03）。 */
    @PostMapping("/{batchId}/generate")
    public ApiResponse<HarvestBatch> generate(@PathVariable Long batchId,
                                             @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(service.generateBatch(batchId, body, TenantContextService.currentTenantId()));
    }

    /** 批次库存在流水。 */
    @GetMapping("/{batchId}/flows")
    public ApiResponse<PageResult<InventoryFlow>> batchFlows(
            @PathVariable Long batchId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize) {
        return ApiResponse.success(service.pageBatchFlows(batchId,
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 50),
                TenantContextService.currentTenantId()));
    }

    /* ==================== 成品库存 ==================== */

    /** 分页查询库存。 */
    @GetMapping("/inventory")
    public ApiResponse<PageResult<Inventory>> pageInventory(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String batchNo,
            @RequestParam(required = false) String warehouseName,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String healthStatus) {
        return ApiResponse.success(service.pageInventory(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                batchNo, warehouseName, category, keyword, healthStatus,
                TenantContextService.currentTenantId()));
    }

    /** 新增库存记录。 */
    @PostMapping("/inventory")
    public ApiResponse<Inventory> createInventory(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(service.createInventory(body, TenantContextService.currentTenantId()));
    }

    /** 成品入库（HARV-05）：累加数量 + 写一条入库流水。 */
    @PostMapping("/inventory/in")
    public ApiResponse<Boolean> stockIn(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(service.stockIn(body, TenantContextService.currentTenantId()));
    }

    /**
     * 出库（HARV-06）。
     *
     * <p>入参走查询串：前端 {@code stockOut()} 就是 params（qty / relatedOrderNo），
     * 带 {@code @RequestBody} 必填会让它每次都是 500。</p>
     */
    @PostMapping("/inventory/{batchId}/out")
    public ApiResponse<InventoryFlow> stockOut(@PathVariable Long batchId,
                                              @RequestParam BigDecimal qty,
                                              @RequestParam(required = false) String relatedOrderNo,
                                              @RequestParam(required = false) String operatorName) {
        return ApiResponse.success(service.stockOut(batchId, qty, relatedOrderNo, operatorName,
                TenantContextService.currentTenantId()));
    }

    /** 冻结库存（返回冻结后的批次，前端按批次判断成功）。 */
    @PostMapping("/inventory/{batchId}/freeze")
    public ApiResponse<HarvestBatch> freeze(@PathVariable Long batchId) {
        return ApiResponse.success(service.freeze(batchId, TenantContextService.currentTenantId()));
    }

    /** 损耗登记（HARV-09）。 */
    @PostMapping("/inventory/{batchId}/loss")
    public ApiResponse<Boolean> loss(@PathVariable Long batchId, @RequestBody Map<String, Object> body) {
        return ApiResponse.success(service.registerLoss(batchId, body, TenantContextService.currentTenantId()));
    }

    /** 库存调拨。 */
    @PostMapping("/inventory/{batchId}/transfer")
    public ApiResponse<Boolean> transfer(@PathVariable Long batchId, @RequestBody Map<String, Object> body) {
        return ApiResponse.success(service.transfer(batchId, body, TenantContextService.currentTenantId()));
    }

    /** 库存详情。 */
    @GetMapping("/inventory/{inventoryId}")
    public ApiResponse<Inventory> detailInventory(@PathVariable Long inventoryId) {
        return ApiResponse.success(service.detailInventory(inventoryId, TenantContextService.currentTenantId()));
    }

    /** 编辑库存记录。 */
    @PutMapping("/inventory/{inventoryId}")
    public ApiResponse<Inventory> updateInventory(@PathVariable Long inventoryId,
                                                 @RequestBody Map<String, Object> body) {
        return ApiResponse.success(service.updateInventory(inventoryId, body, TenantContextService.currentTenantId()));
    }

    /** 删除库存记录。 */
    @DeleteMapping("/inventory/{inventoryId}")
    public ApiResponse<Boolean> deleteInventory(@PathVariable Long inventoryId) {
        service.deleteInventory(inventoryId, TenantContextService.currentTenantId());
        return ApiResponse.success(true);
    }

    /** 某批次的全部库存（多仓时前端要能看到分仓明细）。 */
    @GetMapping("/{batchId}/inventory")
    public ApiResponse<List<Inventory>> batchInventory(@PathVariable Long batchId) {
        return ApiResponse.success(service.inventoryByBatch(batchId, TenantContextService.currentTenantId()));
    }

    /* ==================== 内部工具 ==================== */

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) return value;
        }
        return 1;
    }

    private static Long toLong(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
