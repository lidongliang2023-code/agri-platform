package com.agri.produce.internal.input;

import com.agri.produce.internal.common.DateParams;
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
 * 投入品与供应商（用户端）。
 */
@RestController
@RequestMapping("/api/v1/production/inputs")
@RequiredArgsConstructor
public class InputController {

    private final InputInfoService inputInfoService;
    private final InputStockFlowService inputStockFlowService;
    private final InputUsageService inputUsageService;
    private final SupplierService supplierService;

    @GetMapping
    public ApiResponse<PageResult<InputInfoEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                         @RequestParam(defaultValue = "10") long size,
                                                         @RequestParam(required = false) String keyword,
                                                         @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(inputInfoService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<InputInfoEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(inputInfoService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody InputInfoEntity entity) {
        return ApiResponse.ok(inputInfoService.create(entity).getInputId());
    }

    @PutMapping("/{id}")
    public ApiResponse<InputInfoEntity> update(@PathVariable String id, @RequestBody InputInfoEntity entity) {
        return ApiResponse.ok(inputInfoService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        inputInfoService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/{inputId}/stock-flows")
    public ApiResponse<PageResult<InputStockFlowEntity>> pageInputStockFlow(@RequestParam(defaultValue = "1") long page,
                                                                            @RequestParam(defaultValue = "10") long size) {
        return ApiResponse.ok(inputStockFlowService.page(page, size));
    }

    @GetMapping("/{inputId}/stock-flows/{id}")
    public ApiResponse<InputStockFlowEntity> detailInputStockFlow(@PathVariable String id) {
        return ApiResponse.ok(inputStockFlowService.detail(id));
    }

    @PostMapping("/{inputId}/stock-flows")
    public ApiResponse<String> createInputStockFlow(@RequestBody InputStockFlowEntity entity) {
        return ApiResponse.ok(inputStockFlowService.create(entity).getFlowId());
    }

    @PutMapping("/{inputId}/stock-flows/{id}")
    public ApiResponse<InputStockFlowEntity> updateInputStockFlow(@PathVariable String id, @RequestBody InputStockFlowEntity entity) {
        return ApiResponse.ok(inputStockFlowService.update(id, entity));
    }

    @DeleteMapping("/{inputId}/stock-flows/{id}")
    public ApiResponse<Void> deleteInputStockFlow(@PathVariable String id) {
        inputStockFlowService.delete(id);
        return ApiResponse.ok();
    }

    /**
     * 投入品使用记录分页列表。
     *
     * <p>{@code farmId} 此前不在方法签名里，前端/运营端传了也被静默丢弃，
     * 农场监管详情看到的是全局数据。V10 为 {@code prod_input_usage} 补了 {@code farm_id}
     * 列后落成真实 SQL 条件，为空时行为不变（查全部）。</p>
     *
     * @param farmId 所属农场，可空（新增时由服务端按 plotId 推导填充，见
     *               {@link InputUsageService#create}）
     * @param status 状态，可空
     * @return 分页结果
     */
    @GetMapping("/usages")
    public ApiResponse<PageResult<InputUsageEntity>> pageInputUsage(@RequestParam(defaultValue = "1") long page,
                                                                    @RequestParam(defaultValue = "10") long size,
                                                                    @RequestParam(required = false) String farmId,
                                                                    @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(inputUsageService.page(page, size, farmId, status));
    }

    @GetMapping("/usages/{id}")
    public ApiResponse<InputUsageEntity> detailInputUsage(@PathVariable String id) {
        return ApiResponse.ok(inputUsageService.detail(id));
    }

    @PostMapping("/usages")
    public ApiResponse<String> createInputUsage(@RequestBody InputUsageEntity entity) {
        return ApiResponse.ok(inputUsageService.create(entity).getUsageId());
    }

    @PutMapping("/usages/{id}")
    public ApiResponse<InputUsageEntity> updateInputUsage(@PathVariable String id, @RequestBody InputUsageEntity entity) {
        return ApiResponse.ok(inputUsageService.update(id, entity));
    }

    @DeleteMapping("/usages/{id}")
    public ApiResponse<Void> deleteInputUsage(@PathVariable String id) {
        inputUsageService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/suppliers")
    public ApiResponse<PageResult<SupplierEntity>> pageSupplier(@RequestParam(defaultValue = "1") long page,
                                                                @RequestParam(defaultValue = "10") long size,
                                                                @RequestParam(required = false) String keyword,
                                                                @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(supplierService.page(page, size, keyword, status));
    }

    @GetMapping("/suppliers/{id}")
    public ApiResponse<SupplierEntity> detailSupplier(@PathVariable String id) {
        return ApiResponse.ok(supplierService.detail(id));
    }

    @PostMapping("/suppliers")
    public ApiResponse<String> createSupplier(@RequestBody SupplierEntity entity) {
        return ApiResponse.ok(supplierService.create(entity).getSupplierId());
    }

    @PutMapping("/suppliers/{id}")
    public ApiResponse<SupplierEntity> updateSupplier(@PathVariable String id, @RequestBody SupplierEntity entity) {
        return ApiResponse.ok(supplierService.update(id, entity));
    }

    @DeleteMapping("/suppliers/{id}")
    public ApiResponse<Void> deleteSupplier(@PathVariable String id) {
        supplierService.delete(id);
        return ApiResponse.ok();
    }

    /**
     * 投入品入库。
     *
     * <p>{@code expireDate} 必须落库：效期是批次维度字段，挂在
     * {@code prod_input_stock_flow.expire_date}，是「最近批次效期
     * {@code nearestExpireDate}」与临期预警的唯一数据源。
     * 此前该参数被硬编码传 {@code null}，导致流水效期永远为空、临期判定永远失效，
     * 属于「接口能调通但数据永远不对」的假功能，故补齐透传。</p>
     *
     * @param inputId    投入品业务主键
     * @param qty        入库数量
     * @param batchNo    批次号，可为空
     * @param expireDate 该批次有效期至（yyyy-MM-dd），可为空（无明确保质期时留空）
     * @param operatorId 操作人，可为空
     * @return 入库后的投入品（含最新库存）
     */
    @PostMapping("/{inputId}/stock-in")
    public ApiResponse<InputInfoEntity> stockIn(@PathVariable String inputId,
                                                @RequestParam BigDecimal qty,
                                                @RequestParam(required = false) String batchNo,
                                                @RequestParam(required = false) String expireDate,
                                                @RequestParam(required = false) String operatorId) {
        return ApiResponse.ok(inputInfoService.stockIn(inputId, qty, batchNo,
                DateParams.parseDate(expireDate), operatorId));
    }

    /** 投入品领用 */
    @PostMapping("/{inputId}/consume")
    public ApiResponse<InputInfoEntity> consume(@PathVariable String inputId,
                                                @RequestParam BigDecimal qty,
                                                @RequestParam(required = false) String relatedTaskId,
                                                @RequestParam(required = false) String operatorId) {
        return ApiResponse.ok(inputInfoService.consume(inputId, qty, relatedTaskId, operatorId));
    }

    /** 低库存预警 */
    @GetMapping("/warning")
    public ApiResponse<List<InputInfoEntity>> warning() {
        return ApiResponse.ok(inputInfoService.warningList());
    }

    /** 任务投入品明细 */
    @GetMapping("/usages/by-task")
    public ApiResponse<List<InputUsageEntity>> usagesByTask(@RequestParam String taskId) {
        return ApiResponse.ok(inputUsageService.listByTask(taskId));
    }

    /** 合作中供应商 */
    @GetMapping("/suppliers/active")
    public ApiResponse<List<SupplierEntity>> activeSuppliers() {
        return ApiResponse.ok(supplierService.listActive());
    }

    /** 库存总览（低库存优先） */
    @GetMapping("/stock")
    public ApiResponse<List<InputInfoEntity>> stock() {
        return ApiResponse.ok(inputInfoService.stockList());
    }
}
