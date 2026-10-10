package com.agri.produce.internal.harvest;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 批次库存流水（出入库/盘点/损耗） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class InventoryFlowService {

    private static final String ID_PREFIX = "INVF";

    private final InventoryFlowMapper inventoryFlowMapper;

    /** 台账服务：出库必须同时扣减台账，否则流水与台账脱节 */
    private final InventoryService inventoryService;

    /**
     * 分页查询（不带任何过滤条件，用于库存总览）。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 分页结果
     */
    public PageResult<InventoryFlowEntity> page(long page, long size) {
        return page(page, size, null);
    }

    /**
     * 分页查询，可按批次过滤。
     *
     * <p><b>为什么 batchId 为空时不加条件。</b>该端点语义是「库存总览 + 可选批次筛选」，
     * 若把空串拼成 {@code WHERE batch_id = ''}，库内没有任何记录命中，页面永远空列表。
     * MyBatis-Plus 的 {@code eq(condition, column, value)} 重载会按 condition 决定是否拼接，
     * 因此这里把「是否传了批次」作为布尔条件前置。
     *
     * @param page    页码
     * @param size    每页条数
     * @param batchId 批次号，null/空白表示不过滤
     * @return 分页结果
     */
    public PageResult<InventoryFlowEntity> page(long page, long size, String batchId) {
        boolean filterByBatch = batchId != null && !batchId.isBlank();
        Page<InventoryFlowEntity> result = inventoryFlowMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<InventoryFlowEntity>()
                        .eq(filterByBatch, InventoryFlowEntity::getBatchId,
                                filterByBatch ? batchId.trim() : null)
                        .orderByDesc(InventoryFlowEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public InventoryFlowEntity detail(String id) {
        InventoryFlowEntity entity = inventoryFlowMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public InventoryFlowEntity create(InventoryFlowEntity entity) {
        if (entity.getFlowId() == null || entity.getFlowId().isBlank()) {
            entity.setFlowId(ProduceIds.newId(ID_PREFIX));
        }
        inventoryFlowMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public InventoryFlowEntity update(String id, InventoryFlowEntity entity) {
        entity.setFlowId(id);
        inventoryFlowMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        inventoryFlowMapper.deleteById(id);
    }

    /**
     * 批次库存流水。
     *
     * <p>{@code batchId} 为空时返回全部流水（按创建时间倒序），不再拼
     * {@code batch_id = ''} 这种恒不命中的条件。
     *
     * @param batchId 批次号，null/空白表示不过滤
     * @return 流水列表
     */
    public List<InventoryFlowEntity> listByBatch(String batchId) {
        boolean filterByBatch = batchId != null && !batchId.isBlank();
        return inventoryFlowMapper.selectList(new LambdaQueryWrapper<InventoryFlowEntity>()
                .eq(filterByBatch, InventoryFlowEntity::getBatchId, filterByBatch ? batchId.trim() : null)
                .orderByDesc(InventoryFlowEntity::getCreatedAt));
    }

    /**
     * 批次出库：写 {@code flowType=2} 流水，并同步扣减台账当前库存。
     *
     * <p><b>为什么必须收 {@code operatorName} 并落库（工单 BT-07）。</b>此前签名只有
     * {@code qty / operatorId / relatedOrderNo}，前端 {@code StockInPayload /
     * LossPayload} 真实传的 {@code operatorName} 既没落库也没报错，属于「传了但静默丢弃」，
     * 与「静默写空」同型。现在该字段写入 {@code prod_inventory_flow.operator_name}
     * （V14 新增列），调用方传了就一定看得到，不会再无声消失。
     *
     * <p><b>为什么还要动台账。</b>V14 之前库里没有台账表，出库只能写流水；台账上线后
     * 若出库不同步扣减，{@code currentQty} 就会与流水累计值对不上，等于台账说假话。
     * 该批次没有台账时只写流水（历史数据的既定事实），不凭空造台账行。
     *
     * @param batchId        批次号
     * @param qty            出库数量（正数），不得为 null/非正
     * @param operatorId     操作人ID
     * @param operatorName   操作人姓名（落库，不再静默丢弃）
     * @param relatedOrderNo 关联交易单号
     * @return 出库流水
     */
    @Transactional
    public InventoryFlowEntity outbound(String batchId, BigDecimal qty, String operatorId,
                                        String operatorName, String relatedOrderNo) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "出库数量必须大于 0");
        }
        List<InventoryFlowEntity> history = listByBatch(batchId);
        BigDecimal before = BigDecimal.ZERO;
        for (InventoryFlowEntity flow : history) {
            if (flow.getQty() != null) {
                before = before.add(flow.getQty());
            }
        }
        BigDecimal delta = qty.negate();
        InventoryFlowEntity flow = new InventoryFlowEntity();
        flow.setFlowId(ProduceIds.newId("INVF"));
        flow.setBatchId(batchId);
        flow.setFlowType(2);
        flow.setQty(delta);
        flow.setUnit("kg");
        flow.setBeforeQty(before);
        flow.setAfterQty(before.add(delta));
        flow.setOperatorId(operatorId);
        flow.setOperatorName(operatorName);
        flow.setRelatedOrderNo(relatedOrderNo);
        inventoryFlowMapper.insert(flow);
        inventoryService.syncOutbound(batchId, qty);
        return flow;
    }
}
