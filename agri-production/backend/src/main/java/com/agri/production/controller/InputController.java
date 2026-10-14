package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.dto.InputInfoSaveDTO;
import com.agri.production.dto.InputUsageSaveDTO;
import com.agri.production.entity.InputMaterial;
import com.agri.production.entity.InputStockFlow;
import com.agri.production.entity.InputUsageRecord;
import com.agri.production.service.IInputService;
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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 农资投入品：档案 / 库存流水 / 使用记录（用户端）。
 *
 * <p>路径与入参按前端契约（{@code api/inputs.ts}，BASE = {@code /api/v1/production/inputs}）。
 * 这个控制器替换掉原来的 {@code InputMaterialController}：那个只覆盖 档案 CRUD + 入库/出库，
 * 而页面真正调用的 {@code /warning}、{@code /stock}、{@code /usages}、
 * {@code /{id}/stock-flows}、{@code /{id}/stock-in(qty=…)}、{@code /{id}/consume} 都不存在 ——
 * 同一个路径下两个控制器会让 {@code GET /inputs} 映射冲突、应用直接起不来，所以是替换而不是新增。</p>
 *
 * <p><b>字面量路径先于 {@code /{inputId}} 匹配</b>：{@code /inputs/stock}、{@code /inputs/warning}、
 * {@code /inputs/usages} 都是字面量，Spring 会优先命中它们；不加这三段的话，
 * {@code /inputs/stock} 会被 {@code /{inputId}} 接走并因 Long 转换失败报 400
 * （改之前实测就是这个现象）。</p>
 */
@RestController
@RequestMapping("/api/v1/production/inputs")
public class InputController {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final IInputService inputService;

    public InputController(IInputService inputService) {
        this.inputService = inputService;
    }

    /* ==================== 投入品档案 ==================== */

    /** 分页查询投入品台账。 */
    @GetMapping
    public ApiResponse<PageResult<InputMaterial>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String inputName,
            @RequestParam(required = false) String inputType,
            @RequestParam(required = false) Integer status) {
        String tenantId = TenantContextService.currentTenantId();
        int current = firstNonNull(pageNum, page, 1);
        int limit = firstNonNull(pageSize, size, 10);
        return ApiResponse.success(inputService.page(current, limit,
                keyword != null ? keyword : inputName, status, inputType, tenantId));
    }

    /** 低库存清单（库存 ≤ 预警阈值）。 */
    @GetMapping("/warning")
    public ApiResponse<List<InputMaterial>> warning() {
        return ApiResponse.success(inputService.warningList(TenantContextService.currentTenantId()));
    }

    /**
     * 库存总览（低库存优先）。
     *
     * <p>{@code api/inputs.ts} 里两个函数打的是同一个地址：{@code fetchInputStockOverview}
     * 期望 {@code InputInfo[]}（页面 InputStock 用的就是它），而 {@code listInputStock}
     * 声明的是 {@code PageResult<InputStockRecord>}。同一个 URL 不可能同时是两种形状，
     * 这里按**页面真正在用的那个**返回投入品列表（含 stockQty / warnQty / nearestExpireDate），
     * 后者属前端的口径冲突，已在交付说明里点名。</p>
     */
    @GetMapping("/stock")
    public ApiResponse<List<InputMaterial>> stock() {
        return ApiResponse.success(inputService.stockOverview(TenantContextService.currentTenantId()));
    }

    /**
     * 新增出入库记录（{@code POST /inputs/stock}）。
     *
     * <p>与 {@code /{inputId}/stock-flows} 是**同一本台账的两种叫法**：这里收的是
     * {@code InputStockRecord} 口径（stockType 1入库 2出库 + quantity），落库仍是库存流水，
     * 返回也按 {@code InputStockRecord} 的字段名给出。写一次库存就要有一条流水与之对应，
     * 不允许绕开流水直接改库存。</p>
     */
    @PostMapping("/stock")
    public ApiResponse<Map<String, Object>> createStock(@RequestBody Map<String, Object> body) {
        String tenantId = TenantContextService.currentTenantId();
        Long inputId = toLong(body.get("inputId"));
        if (inputId == null) {
            throw new BusinessException(400, "inputId 不能为空");
        }
        Integer stockType = toInteger(body.get("stockType"));
        if (stockType == null) {
            throw new BusinessException(400, "stockType 不能为空（1 入库 / 2 出库）");
        }
        BigDecimal quantity = toDecimal(body.get("quantity"));
        InputStockFlow flow = new InputStockFlow();
        // 回收场景（stockType=3）等暂无对应词表值，只认 1/2，其余明确拒绝而不是猜一个
        if (stockType == 1) {
            flow.setFlowType(1);
        } else if (stockType == 2) {
            flow.setFlowType(2);
        } else {
            throw new BusinessException(400, "未知的出入库类型：" + stockType + "（1 入库 / 2 出库）");
        }
        flow.setQty(quantity);
        flow.setBatchNo(str(body.get("batchNo")));
        flow.setOperatorId(toLong(body.get("operatorId")));
        flow.setRemark(str(body.get("remark")));
        InputStockFlow saved = inputService.createFlow(inputId, flow, tenantId);
        InputMaterial material = inputService.detail(inputId, tenantId);

        Map<String, Object> record = new LinkedHashMap<>();
        record.put("recordId", saved.getFlowId());
        record.put("inputId", inputId);
        record.put("inputName", material.getInputName());
        record.put("stockType", stockType);
        record.put("quantity", saved.getQty().abs());
        record.put("unit", material.getUnit());
        record.put("batchNo", saved.getBatchNo());
        record.put("supplier", str(body.get("supplier")));
        record.put("price", toDecimal(body.get("price")));
        record.put("operatorId", saved.getOperatorId());
        record.put("operatorName", str(body.get("operatorName")));
        record.put("operateAt", saved.getCreateTime() == null ? null : saved.getCreateTime().format(DATE_TIME));
        record.put("remark", saved.getRemark());
        return ApiResponse.success(record);
    }

    /** 删除出入库记录（= 删除对应的那条库存流水，并把库存回滚）。 */
    @DeleteMapping("/stock/{recordId}")
    public ApiResponse<Boolean> deleteStock(@PathVariable Long recordId,
                                           @RequestParam(required = false) Long inputId) {
        String tenantId = TenantContextService.currentTenantId();
        Long owner = inputId;
        if (owner == null) {
            throw new BusinessException(400, "缺少 inputId（该记录属于哪个投入品）");
        }
        inputService.deleteFlow(owner, recordId, tenantId);
        return ApiResponse.success(true);
    }

    /** 库存流水（某投入品）。 */
    @GetMapping("/{inputId}/stock-flows")
    public ApiResponse<PageResult<InputStockFlow>> pageFlows(
            @PathVariable Long inputId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) Integer flowType) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(inputService.pageFlows(inputId,
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), flowType, tenantId));
    }

    /** 新增库存流水（退回 / 盘盈 / 盘亏 / 报损等非标准作业）。 */
    @PostMapping("/{inputId}/stock-flows")
    public ApiResponse<String> createFlow(@PathVariable Long inputId, @RequestBody InputStockFlow flow) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(String.valueOf(inputService.createFlow(inputId, flow, tenantId).getFlowId()));
    }

    /** 删除库存流水（库存同步回滚）。 */
    @DeleteMapping("/{inputId}/stock-flows/{flowId}")
    public ApiResponse<Void> deleteFlow(@PathVariable Long inputId, @PathVariable Long flowId) {
        inputService.deleteFlow(inputId, flowId, TenantContextService.currentTenantId());
        return ApiResponse.success();
    }

    /**
     * 入库：写流水 + 增加库存。
     *
     * <p>入参走查询串而不是请求体 —— 前端 {@code stockIn()} 就是 {@code params}，
     * 带 {@code @RequestBody} 必填会让它每次都是"Content-Type ... is not supported"的 500。</p>
     */
    @PostMapping("/{inputId}/stock-in")
    public ApiResponse<InputMaterial> stockIn(@PathVariable Long inputId,
                                             @RequestParam BigDecimal qty,
                                             @RequestParam(required = false) String batchNo,
                                             @RequestParam(required = false) String expireDate,
                                             @RequestParam(required = false) Long operatorId) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(inputService.stockIn(inputId, qty, batchNo, expireDate, operatorId, tenantId));
    }

    /** 领用：写流水 + 扣减库存。 */
    @PostMapping("/{inputId}/consume")
    public ApiResponse<InputMaterial> consume(@PathVariable Long inputId,
                                             @RequestParam BigDecimal qty,
                                             @RequestParam(required = false) Long relatedTaskId,
                                             @RequestParam(required = false) Long operatorId) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(inputService.consume(inputId, qty, relatedTaskId, operatorId, tenantId));
    }

    /* ==================== 使用记录 ==================== */

    /** 分页查询使用记录。 */
    @GetMapping("/usages")
    public ApiResponse<PageResult<InputUsageRecord>> pageUsages(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String inputId,
            @RequestParam(required = false) String plotId,
            @RequestParam(required = false) String taskId,
            @RequestParam(required = false) String farmId) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(inputService.pageUsages(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                status, toLong(inputId), toLong(plotId), toLong(taskId), toLong(farmId), tenantId));
    }

    /** 新增使用记录。 */
    @PostMapping("/usages")
    public ApiResponse<String> createUsage(@RequestBody InputUsageSaveDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(String.valueOf(inputService.createUsage(dto, tenantId).getUsageId()));
    }

    /** 任务关联的投入品使用明细。 */
    @GetMapping("/usages/by-task")
    public ApiResponse<List<InputUsageRecord>> usagesByTask(@RequestParam Long taskId) {
        return ApiResponse.success(inputService.usagesByTask(taskId, TenantContextService.currentTenantId()));
    }

    /** 更新使用记录。 */
    @PutMapping("/usages/{usageId}")
    public ApiResponse<InputUsageRecord> updateUsage(@PathVariable Long usageId, @RequestBody InputUsageSaveDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(inputService.updateUsage(usageId, dto, tenantId));
    }

    /** 删除使用记录（逻辑删除）。 */
    @DeleteMapping("/usages/{usageId}")
    public ApiResponse<Void> deleteUsage(@PathVariable Long usageId) {
        inputService.deleteUsage(usageId, TenantContextService.currentTenantId());
        return ApiResponse.success();
    }

    /* ==================== 档案的增删改查（放在最后，避免与上面的字面量路径抢匹配） ==================== */

    /** 投入品详情。 */
    @GetMapping("/{inputId}")
    public ApiResponse<InputMaterial> detail(@PathVariable Long inputId) {
        return ApiResponse.success(inputService.detail(inputId, TenantContextService.currentTenantId()));
    }

    /** 新增投入品档案，返回新档案 ID。 */
    @PostMapping
    public ApiResponse<String> create(@RequestBody InputInfoSaveDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(String.valueOf(inputService.create(dto, tenantId).getInputId()));
    }

    /** 编辑投入品档案。 */
    @PutMapping("/{inputId}")
    public ApiResponse<InputMaterial> update(@PathVariable Long inputId, @RequestBody InputInfoSaveDTO dto) {
        String tenantId = TenantContextService.currentTenantId();
        return ApiResponse.success(inputService.update(inputId, dto, tenantId));
    }

    /** 删除投入品档案（逻辑删除）。 */
    @DeleteMapping("/{inputId}")
    public ApiResponse<Void> delete(@PathVariable Long inputId) {
        inputService.delete(inputId, TenantContextService.currentTenantId());
        return ApiResponse.success();
    }

    /* ==================== 内部工具 ==================== */

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        String text = str(value);
        if (text == null) {
            return null;
        }
        try {
            return Long.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer toInteger(Object value) {
        Long parsed = toLong(value);
        return parsed == null ? null : parsed.intValue();
    }

    private static BigDecimal toDecimal(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        String text = str(value);
        if (text == null) {
            return null;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException e) {
            throw new BusinessException(400, "数量格式不正确：" + text);
        }
    }
}
