package com.agri.produce.internal.harvest;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * 库存台账 应用服务。
 *
 * <p><b>为什么单独建一个 Service。</b>此前「库存」在后端只有流水服务
 * {@link InventoryFlowService}，没有台账服务，于是
 * {@code GET /harvests/inventory} 返回的是流水、四个写接口无处落库（BT-01 ~ BT-05）。
 * 台账与流水是两个不同的聚合：台账是「当前状态」，流水是「变化历史」，
 * 写操作必须同时动两者（改台账 + 记流水），因此放在本服务内统一编排。
 *
 * <p><b>写操作纪律：先校验、再落库、绝不静默丢弃。</b>
 * <ul>
 *   <li>数量必须 &gt; 0，缺参数或非法值抛 {@code 400} 并带明确原因，不默认成 0；</li>
 *   <li>报损 / 调拨 / 出库数量超过当前库存抛 {@code 400}，不允许把库存记成负数；</li>
 *   <li>找不到对应台账抛 {@code 404}，不返回空实体冒充成功；</li>
 *   <li>调用方传的 {@code operatorName} 一律落库到流水 {@code operator_name}
 *       （BT-07），不再出现「传了但不报错也不落库」。</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class InventoryService {

    private static final String ID_PREFIX = "INV";

    /** 默认计量单位 */
    private static final String DEFAULT_UNIT = "kg";

    /** 健康状态：正常 */
    private static final String HEALTH_NORMAL = "normal";

    /** 健康状态：预警（低于安全库存） */
    private static final String HEALTH_WARNING = "warning";

    /** 健康状态：不足（低于安全库存的一半） */
    private static final String HEALTH_SHORTAGE = "shortage";

    /** 健康状态：临期（距保质期 ≤ 3 天） */
    private static final String HEALTH_EXPIRING = "expiring";

    /** 临期判定阈值（天），与前端 resolveInventoryHealth 保持一致 */
    private static final long EXPIRING_DAYS = 3L;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final InventoryMapper inventoryMapper;
    private final InventoryFlowMapper inventoryFlowMapper;
    private final HarvestBatchMapper harvestBatchMapper;

    /* ------------------------------------------------------------------ 读 */

    /**
     * 分页查询库存台账，支持 仓库 / 品类 / 健康状态 / 批次号 / 品名关键字 筛选。
     *
     * <p><b>为什么空值一律表示「不过滤」。</b>把空串拼成
     * {@code WHERE warehouse_name = ''} 会静默返回 0 条（本项目已在此栽过一次），
     * 因此每个条件都用 MyBatis-Plus 的 {@code condition} 重载前置布尔判断。
     *
     * @param page         页码
     * @param size         每页条数
     * @param batchNo      批次号（精确匹配），null/空白表示不过滤
     * @param warehouseName 仓库名称（模糊），null/空白表示不过滤
     * @param category     品类（精确），null/空白表示不过滤
     * @param healthStatus 健康状态（精确），null/空白表示不过滤
     * @param keyword      品名关键字（模糊），null/空白表示不过滤
     * @return 台账分页
     */
    public PageResult<InventoryEntity> page(long page, long size, String batchNo, String warehouseName,
                                            String category, String healthStatus, String keyword) {
        boolean hasBatchNo = batchNo != null && !batchNo.isBlank();
        boolean hasWarehouse = warehouseName != null && !warehouseName.isBlank();
        boolean hasCategory = category != null && !category.isBlank();
        boolean hasHealth = healthStatus != null && !healthStatus.isBlank();
        boolean hasKeyword = keyword != null && !keyword.isBlank();
        Page<InventoryEntity> result = inventoryMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<InventoryEntity>()
                        .eq(hasBatchNo, InventoryEntity::getBatchNo, hasBatchNo ? batchNo.trim() : null)
                        .like(hasWarehouse, InventoryEntity::getWarehouseName, hasWarehouse ? warehouseName.trim() : null)
                        .eq(hasCategory, InventoryEntity::getCategory, hasCategory ? category.trim() : null)
                        .eq(hasHealth, InventoryEntity::getHealthStatus, hasHealth ? healthStatus.trim() : null)
                        .like(hasKeyword, InventoryEntity::getProductName, hasKeyword ? keyword.trim() : null)
                        .orderByDesc(InventoryEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 台账详情，不存在抛 NOT_FOUND。
     *
     * @param inventoryId 台账主键
     * @return 台账实体
     */
    public InventoryEntity detail(String inventoryId) {
        InventoryEntity entity = inventoryMapper.selectById(inventoryId);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "库存台账不存在：" + inventoryId);
        }
        return entity;
    }

    /**
     * 按批次查询台账（调拨 / 报损 / 出库定位库存行用），取当前库存最大的一条。
     *
     * @param batchId 批次ID
     * @return 台账列表
     */
    public List<InventoryEntity> listByBatch(String batchId) {
        boolean hasBatch = batchId != null && !batchId.isBlank();
        return inventoryMapper.selectList(new LambdaQueryWrapper<InventoryEntity>()
                .eq(hasBatch, InventoryEntity::getBatchId, hasBatch ? batchId.trim() : null)
                .orderByDesc(InventoryEntity::getCurrentQty));
    }

    /* ------------------------------------------------------------------ 写 */

    /**
     * 新增台账（工单 BT-05）。缺省主键时自动生成；安全库存缺省 0。
     *
     * @param entity 待落库台账
     * @return 落库后的台账
     */
    @Transactional
    public InventoryEntity create(InventoryEntity entity) {
        if (entity.getBatchId() == null || entity.getBatchId().isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "batchId 必填");
        }
        if (entity.getInventoryId() == null || entity.getInventoryId().isBlank()) {
            entity.setInventoryId(ProduceIds.newId(ID_PREFIX));
        }
        if (entity.getCurrentQty() == null) {
            entity.setCurrentQty(BigDecimal.ZERO);
        }
        if (entity.getFrozenQty() == null) {
            entity.setFrozenQty(BigDecimal.ZERO);
        }
        if (entity.getLossQty() == null) {
            entity.setLossQty(BigDecimal.ZERO);
        }
        if (entity.getUnit() == null || entity.getUnit().isBlank()) {
            entity.setUnit(DEFAULT_UNIT);
        }
        if (entity.getFrozen() == null) {
            entity.setFrozen(Boolean.FALSE);
        }
        // 批次号 / 品名 / 品类 / 等级 从批次表补齐，避免新建的台账 batchNo 为 null
        applyBatchSnapshot(entity, entity.getBatchId());
        normalize(entity);
        inventoryMapper.insert(entity);
        return entity;
    }

    /**
     * 更新台账（以路径上的主键为准）。
     *
     * @param inventoryId 台账主键
     * @param entity      待更新内容
     * @return 更新后的台账
     */
    @Transactional
    public InventoryEntity update(String inventoryId, InventoryEntity entity) {
        detail(inventoryId);
        entity.setInventoryId(inventoryId);
        normalize(entity);
        inventoryMapper.updateById(entity);
        return detail(inventoryId);
    }

    /**
     * 逻辑删除台账。
     *
     * @param inventoryId 台账主键
     */
    @Transactional
    public void delete(String inventoryId) {
        detail(inventoryId);
        inventoryMapper.deleteById(inventoryId);
    }

    /**
     * 成品入库（工单 BT-02）：台账当前库存增加 + 写 {@code flowType=1} 流水
     * + 把批次标记为已入库。
     *
     * <p>同一「批次 + 仓库 + 库位」已存在台账时累加，否则新建一行。
     *
     * @param request 入库入参
     * @return 入库后的台账
     */
    @Transactional
    public InventoryEntity stockIn(InventoryStockInRequest request) {
        requireBody(request, "入库请求体不能为空");
        String batchId = requireText(request.getBatchId(), "batchId 必填");
        String warehouseName = requireText(request.getWarehouseName(), "warehouseName 必填");
        BigDecimal quantity = requirePositive(request.getQuantity(), "入库数量必须大于 0");

        String locationCode = blankToNull(request.getLocationCode());
        InventoryEntity ledger = findLedger(batchId, warehouseName, locationCode);
        boolean created = ledger == null;
        if (created) {
            ledger = new InventoryEntity();
            ledger.setInventoryId(ProduceIds.newId(ID_PREFIX));
            ledger.setBatchId(batchId);
            ledger.setWarehouseName(warehouseName);
            ledger.setLocationCode(locationCode);
            ledger.setCurrentQty(BigDecimal.ZERO);
            ledger.setFrozenQty(BigDecimal.ZERO);
            ledger.setLossQty(BigDecimal.ZERO);
            ledger.setUnit(blankToNull(request.getUnit()) == null ? DEFAULT_UNIT : request.getUnit().trim());
            ledger.setFrozen(Boolean.FALSE);
            applyBatchSnapshot(ledger, batchId);
            ledger.setExpireDate(parseDate(request.getExpireDate()));
            ledger.setRemark(request.getRemark());
        }

        BigDecimal before = nvl(ledger.getCurrentQty());
        BigDecimal after = before.add(quantity);
        ledger.setCurrentQty(after);
        ledger.setLastInAt(LocalDateTime.now());
        if (blankToNull(request.getUnit()) != null) {
            ledger.setUnit(request.getUnit().trim());
        }
        if (request.getExpireDate() != null && !request.getExpireDate().isBlank()) {
            ledger.setExpireDate(parseDate(request.getExpireDate()));
        }
        if (request.getRemark() != null && !request.getRemark().isBlank()) {
            ledger.setRemark(request.getRemark());
        }
        ledger.setHealthStatus(resolveHealth(ledger));

        if (created) {
            inventoryMapper.insert(ledger);
        } else {
            inventoryMapper.updateById(ledger);
        }

        inventoryFlowMapper.insert(buildFlow(batchId, ledger.getWarehouseId(), warehouseName,
                1, quantity, ledger.getUnit(), before, after, null, request.getOperatorName(),
                null, request.getRemark()));

        markBatchInbound(batchId, warehouseName);
        return ledger;
    }

    /**
     * 损耗登记（工单 BT-03）：台账扣减 + 累加损耗 + 写 {@code flowType=4} 流水。
     *
     * @param batchId 批次ID（路径变量）
     * @param request 损耗入参
     * @return 扣减后的台账
     */
    @Transactional
    public InventoryEntity registerLoss(String batchId, InventoryLossRequest request) {
        requireBody(request, "报损请求体不能为空");
        requireText(batchId, "batchId 必填");
        BigDecimal quantity = requirePositive(request.getQuantity(), "损耗数量必须大于 0");
        InventoryEntity ledger = requireLedger(batchId);

        BigDecimal before = nvl(ledger.getCurrentQty());
        if (before.compareTo(quantity) < 0) {
            // 明确拒绝：不截断、不记成负数、不返回假成功
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "损耗数量 " + quantity.toPlainString() + " 超过批次 " + batchId
                            + " 的当前库存 " + before.toPlainString());
        }
        BigDecimal after = before.subtract(quantity);
        ledger.setCurrentQty(after);
        ledger.setLossQty(nvl(ledger.getLossQty()).add(quantity));
        ledger.setLossReason(request.getReason());
        ledger.setLastOutAt(LocalDateTime.now());
        if (request.getRemark() != null && !request.getRemark().isBlank()) {
            ledger.setRemark(request.getRemark());
        }
        ledger.setHealthStatus(resolveHealth(ledger));
        inventoryMapper.updateById(ledger);

        inventoryFlowMapper.insert(buildFlow(batchId, ledger.getWarehouseId(), ledger.getWarehouseName(),
                4, quantity.negate(), ledger.getUnit(), before, after, null, request.getOperatorName(),
                null, defaultText(request.getRemark(), request.getReason())));

        if (after.compareTo(BigDecimal.ZERO) <= 0) {
            markBatchStatus(batchId, 3);
        }
        return ledger;
    }

    /**
     * 库存调拨（工单 BT-04）：原库位扣减 + 目标仓库（库位）累加 + 写成对流水。
     *
     * @param batchId 批次ID（路径变量）
     * @param request 调拨入参
     * @return 调拨后的原台账
     */
    @Transactional
    public InventoryEntity transfer(String batchId, InventoryTransferRequest request) {
        requireBody(request, "调拨请求体不能为空");
        requireText(batchId, "batchId 必填");
        String targetWarehouse = requireText(request.getTargetWarehouse(), "targetWarehouse 必填");
        BigDecimal quantity = requirePositive(request.getQuantity(), "调拨数量必须大于 0");
        String targetLocation = blankToNull(request.getLocationCode());

        InventoryEntity source = requireLedger(batchId);
        BigDecimal before = nvl(source.getCurrentQty());
        if (before.compareTo(quantity) < 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "调拨数量 " + quantity.toPlainString() + " 超过批次 " + batchId
                            + " 的当前库存 " + before.toPlainString());
        }
        BigDecimal after = before.subtract(quantity);
        source.setCurrentQty(after);
        source.setLastOutAt(LocalDateTime.now());
        source.setHealthStatus(resolveHealth(source));
        inventoryMapper.updateById(source);

        inventoryFlowMapper.insert(buildFlow(batchId, source.getWarehouseId(), source.getWarehouseName(),
                2, quantity.negate(), source.getUnit(), before, after, null, null,
                null, request.getRemark()));

        InventoryEntity target = findLedger(batchId, targetWarehouse, targetLocation);
        boolean created = target == null;
        if (created) {
            target = new InventoryEntity();
            target.setInventoryId(ProduceIds.newId(ID_PREFIX));
            target.setBatchId(batchId);
            target.setWarehouseName(targetWarehouse);
            target.setLocationCode(targetLocation);
            target.setCurrentQty(BigDecimal.ZERO);
            target.setFrozenQty(BigDecimal.ZERO);
            target.setLossQty(BigDecimal.ZERO);
            target.setUnit(source.getUnit());
            target.setFrozen(Boolean.FALSE);
            target.setExpireDate(source.getExpireDate());
            applyBatchSnapshot(target, batchId);
            target.setRemark(request.getRemark());
        }
        BigDecimal targetBefore = nvl(target.getCurrentQty());
        BigDecimal targetAfter = targetBefore.add(quantity);
        target.setCurrentQty(targetAfter);
        target.setLastInAt(LocalDateTime.now());
        target.setHealthStatus(resolveHealth(target));
        if (created) {
            inventoryMapper.insert(target);
        } else {
            inventoryMapper.updateById(target);
        }

        inventoryFlowMapper.insert(buildFlow(batchId, target.getWarehouseId(), targetWarehouse,
                1, quantity, target.getUnit(), targetBefore, targetAfter, null, null,
                null, request.getRemark()));

        return source;
    }

    /**
     * 出库同步：由 {@link InventoryFlowService#outbound} 在写完流水后回调，
     * 把台账当前库存同步扣减（此前台账不存在，出库只动流水，台账与流水会脱节）。
     *
     * <p>该批次没有台账时直接返回 —— 历史数据没有台账是既定事实，不凭空造一行。
     *
     * @param batchId 批次ID
     * @param qty     出库数量（正数）
     */
    public void syncOutbound(String batchId, BigDecimal qty) {
        List<InventoryEntity> ledgers = listByBatch(batchId);
        if (ledgers.isEmpty()) {
            // 历史数据没有台账是既定事实，不凭空造一行，也不拦住流水写入
            return;
        }
        InventoryEntity ledger = ledgers.get(0);
        BigDecimal before = nvl(ledger.getCurrentQty());
        BigDecimal delta = nvl(qty);
        if (before.compareTo(delta) < 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "出库数量 " + delta.toPlainString() + " 超过批次 " + batchId
                            + " 的当前库存 " + before.toPlainString());
        }
        ledger.setCurrentQty(before.subtract(delta));
        ledger.setLastOutAt(LocalDateTime.now());
        ledger.setHealthStatus(resolveHealth(ledger));
        inventoryMapper.updateById(ledger);
    }

    /* -------------------------------------------------------------- 内部辅助 */

    /**
     * 定位「批次 + 仓库 + 库位」对应的台账行。库位为空时按「批次 + 仓库」匹配。
     *
     * @param batchId       批次ID
     * @param warehouseName 仓库名称
     * @param locationCode  库位编号，可为 null
     * @return 台账行，不存在返回 null
     */
    private InventoryEntity findLedger(String batchId, String warehouseName, String locationCode) {
        LambdaQueryWrapper<InventoryEntity> wrapper = Wrappers.<InventoryEntity>lambdaQuery()
                .eq(InventoryEntity::getBatchId, batchId)
                .eq(InventoryEntity::getWarehouseName, warehouseName)
                .orderByDesc(InventoryEntity::getCurrentQty);
        if (locationCode == null) {
            wrapper.isNull(InventoryEntity::getLocationCode);
        } else {
            wrapper.eq(InventoryEntity::getLocationCode, locationCode);
        }
        List<InventoryEntity> rows = inventoryMapper.selectList(wrapper);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 取批次台账，不存在抛 404（不返回空实体冒充成功）。
     *
     * @param batchId 批次ID
     * @return 台账行
     */
    private InventoryEntity requireLedger(String batchId) {
        List<InventoryEntity> ledgers = listByBatch(batchId);
        if (ledgers.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "批次 " + batchId + " 暂无库存台账，无法出库/报损");
        }
        return ledgers.get(0);
    }

    /**
     * 把批次上的品名 / 品类 / 等级 / 批次号 冗余到台账，避免列表二次查批次表。
     *
     * <p><b>只补空字段，不覆盖调用方显式传入的值。</b>新增台账（BT-05）时前端会传
     * {@code productName / category / grade}，若在这里无条件覆盖，调用方传的值就被
     * 静默替换成批次表的值 —— 又是一种「传了但不生效」。
     *
     * @param ledger  台账
     * @param batchId 批次ID
     */
    private void applyBatchSnapshot(InventoryEntity ledger, String batchId) {
        HarvestBatchEntity batch = harvestBatchMapper.selectById(batchId);
        if (batch == null) {
            return;
        }
        if (ledger.getBatchNo() == null || ledger.getBatchNo().isBlank()) {
            ledger.setBatchNo(batch.getBatchNo());
        }
        if (ledger.getGrade() == null || ledger.getGrade().isBlank()) {
            ledger.setGrade(batch.getGrade());
        }
        // 品类没有独立主数据表，取批次品种（crop_variety）作为品类口径
        String category = batch.getCropVariety();
        if (ledger.getCategory() == null || ledger.getCategory().isBlank()) {
            ledger.setCategory(category);
        }
        if (ledger.getProductName() == null || ledger.getProductName().isBlank()) {
            String name = (category == null || category.isBlank() ? "农产品" : category);
            String grade = ledger.getGrade();
            ledger.setProductName(name + (grade == null || grade.isBlank() ? "" : "(" + grade + ")"));
        }
        if (ledger.getRelatedBatchNo() == null || ledger.getRelatedBatchNo().isBlank()) {
            ledger.setRelatedBatchNo(batch.getBatchNo());
        }
    }

    /**
     * 批次标记已入库（观察项裁决：{@code inboundStatus} / {@code warehouseName} 由入库动作真写入）。
     *
     * @param batchId       批次ID
     * @param warehouseName 入库仓库
     */
    private void markBatchInbound(String batchId, String warehouseName) {
        HarvestBatchEntity batch = harvestBatchMapper.selectById(batchId);
        if (batch == null) {
            return;
        }
        batch.setInboundStatus(1);
        batch.setWarehouseName(warehouseName);
        harvestBatchMapper.updateById(batch);
    }

    /**
     * 更新批次状态。
     *
     * @param batchId 批次ID
     * @param status  目标状态（3 清空）
     */
    private void markBatchStatus(String batchId, int status) {
        HarvestBatchEntity batch = harvestBatchMapper.selectById(batchId);
        if (batch == null) {
            return;
        }
        batch.setStatus(status);
        harvestBatchMapper.updateById(batch);
    }

    /**
     * 构造一条库存流水。
     *
     * @param batchId       批次ID
     * @param warehouseId   仓库ID
     * @param warehouseName 仓库名称
     * @param flowType      流水类型 1入库 2出库 3盘点 4损耗
     * @param qty           变动数量（出库/损耗为负）
     * @param unit          单位
     * @param beforeQty     变动前库存
     * @param afterQty      变动后库存
     * @param operatorId    操作人ID
     * @param operatorName  操作人姓名
     * @param relatedOrderNo 关联单号
     * @param remark        备注
     * @return 流水实体（未落库）
     */
    private InventoryFlowEntity buildFlow(String batchId, String warehouseId, String warehouseName,
                                          int flowType, BigDecimal qty, String unit,
                                          BigDecimal beforeQty, BigDecimal afterQty,
                                          String operatorId, String operatorName,
                                          String relatedOrderNo, String remark) {
        InventoryFlowEntity flow = new InventoryFlowEntity();
        flow.setFlowId(ProduceIds.newId("INVF"));
        flow.setBatchId(batchId);
        flow.setWarehouseId(warehouseId);
        flow.setWarehouseName(warehouseName);
        flow.setFlowType(flowType);
        flow.setQty(qty);
        flow.setUnit(unit == null || unit.isBlank() ? DEFAULT_UNIT : unit);
        flow.setBeforeQty(beforeQty);
        flow.setAfterQty(afterQty);
        flow.setOperatorId(operatorId);
        flow.setOperatorName(operatorName);
        flow.setRelatedOrderNo(relatedOrderNo);
        flow.setRemark(remark);
        return flow;
    }

    /**
     * 重算健康状态（与前端 {@code resolveInventoryHealth} 同序：不足 &gt; 临期 &gt; 预警 &gt; 正常）。
     *
     * @param ledger 台账
     * @return 健康状态枚举串
     */
    private String resolveHealth(InventoryEntity ledger) {
        BigDecimal current = nvl(ledger.getCurrentQty());
        BigDecimal safe = nvl(ledger.getSafeQty());
        if (safe.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal half = safe.multiply(new BigDecimal("0.5"));
            if (current.compareTo(half) <= 0) {
                return HEALTH_SHORTAGE;
            }
        }
        LocalDate expireDate = ledger.getExpireDate();
        if (expireDate != null) {
            long days = ChronoUnit.DAYS.between(LocalDate.now(), expireDate);
            if (days <= EXPIRING_DAYS) {
                return HEALTH_EXPIRING;
            }
        }
        if (safe.compareTo(BigDecimal.ZERO) > 0 && current.compareTo(safe) <= 0) {
            return HEALTH_WARNING;
        }
        return HEALTH_NORMAL;
    }

    /** 字段归一化：金额类不为空、单位有默认、冻结位不为空 */
    private void normalize(InventoryEntity entity) {
        if (entity.getCurrentQty() == null) {
            entity.setCurrentQty(BigDecimal.ZERO);
        }
        if (entity.getFrozenQty() == null) {
            entity.setFrozenQty(BigDecimal.ZERO);
        }
        if (entity.getLossQty() == null) {
            entity.setLossQty(BigDecimal.ZERO);
        }
        if (entity.getFrozen() == null) {
            entity.setFrozen(Boolean.FALSE);
        }
        entity.setHealthStatus(resolveHealth(entity));
    }

    private static BigDecimal nvl(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String defaultText(String primary, String fallback) {
        return primary == null || primary.isBlank() ? fallback : primary;
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, message);
        }
        return value.trim();
    }

    /**
     * 请求体空指针防御：Spring 的 {@code @RequestBody} 在客户端发空体时可能给到 null，
     * 直接取字段会 NPE 并被全局处理器转成 500「系统繁忙」，把「参数缺失」这个真实
     * 原因掩盖掉。这里显式转成 400 并带明确原因。
     *
     * @param body    请求体
     * @param message 提示语
     */
    private static void requireBody(Object body, String message) {
        if (body == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, message);
        }
    }

    private static BigDecimal requirePositive(BigDecimal value, String message) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, message);
        }
        return value;
    }

    /**
     * 解析 {@code yyyy-MM-dd} 日期；空白返回 null，格式非法抛 400（不静默吞掉）。
     *
     * @param text 日期文本
     * @return 日期，可空
     */
    private static LocalDate parseDate(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(text.trim(), DATE_FORMATTER);
        } catch (DateTimeParseException ex) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "expireDate 格式应为 yyyy-MM-dd，实际为：" + text);
        }
    }
}
