package com.agri.produce.internal.harvest;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.math.BigDecimal;
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

    /**
     * 批次库存流水。
     *
     * <p><b>为什么必须带上路径上的 batchId。</b>此前该方法签名只有 {@code page/size}，
     * 路径变量 {@code {batchId}} 取了不用，永远返回全表分页。前端
     * {@code src/api/harvests.ts queryInventoryFlows} 明确传了批次号，用户以为在看
     * 「这一批的流水」，实际看的是全部——比不筛选更糟，因为它给了筛选的假象。
     *
     * <p>{@code batchId} 为空（路径不会为空，此处仅为防御）时不加条件，返回全量，
     * <b>不返回空列表</b>——空列表会让调用方误判为「这批没有流水」。
     */
    @GetMapping("/{batchId}/flows")
    public ApiResponse<PageResult<InventoryFlowEntity>> pageInventoryFlow(
            @PathVariable String batchId,
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size) {
        return ApiResponse.ok(inventoryFlowService.page(page, size, batchId));
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

    /**
     * 采收计划（按地块聚合采收记录，地块可选）。
     *
     * <p><b>为什么返回 PageResult 而不是裸 List。</b>前端
     * {@code src/api/harvests.ts queryHarvestPlans} 按 {@code PageResult<HarvestPlan>}
     * 解构（响应拦截器 {@code normalizePageData} 再把 {@code records} 归一化为
     * {@code list}），后端吐裸数组时 {@code records/total} 取不到，列表恒为空。
     *
     * <p><b>为什么 plotId 缺省不加条件。</b>此前实现写的是
     * {@code listByPlot(plotId == null ? "" : plotId)}，把 null 转成空串后拼成
     * {@code WHERE plot_id = ''}，库内没有任何记录命中 —— 该端点<b>恒定返回 0 条</b>。
     * 现在空值表示「不过滤」，不传 plotId 时返回全部采收记录。
     *
     * <p><b>为什么不收 farmId。</b>{@code prod_harvest_record} 表没有 {@code farm_id} 列，
     * 按农场过滤在后端无数据源可实现。前端此前传 {@code farmId}，后端忽略，属于
     * 「传了参数但不生效」的假功能；本轮不接该参数，改由前端传 {@code plotId}。
     *
     * @param page   页码，默认 1
     * @param size   每页条数，默认 10
     * @param plotId 地块号，null/空白表示不过滤
     * @return 采收记录分页
     */
    @GetMapping("/plan")
    public ApiResponse<PageResult<HarvestRecordEntity>> plan(@RequestParam(defaultValue = "1") long page,
                                                             @RequestParam(defaultValue = "10") long size,
                                                             @RequestParam(required = false) String plotId) {
        return ApiResponse.ok(harvestRecordService.pageByPlot(page, size, plotId));
    }

    /**
     * 库存流水总览（可按批次筛选）。
     *
     * <p><b>为什么返回 PageResult 而不是裸 List。</b>前端
     * {@code src/api/harvests.ts queryInventory} 按 {@code PageResult<T>} 解构
     * （响应拦截器 {@code normalizePageData} 再把 {@code records} 归一化为 {@code list}），
     * 后端吐裸数组时 {@code response.data.records/total} 取不到，列表恒为空。
     *
     * <p><b>为什么 batchId 缺省不加条件。</b>此前实现把空串透传给 Service 拼成
     * {@code WHERE batch_id = ''}，不传筛选时静默返回 0 条；现在空值表示「不过滤」。
     */
    @GetMapping("/inventory")
    public ApiResponse<PageResult<InventoryFlowEntity>> inventory(@RequestParam(defaultValue = "1") long page,
                                                                  @RequestParam(defaultValue = "10") long size,
                                                                  @RequestParam(required = false) String batchId) {
        return ApiResponse.ok(inventoryFlowService.page(page, size, batchId));
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
