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

    /**
     * 分页查询。
     *
     * @return 分页结果
     */
    public PageResult<InventoryFlowEntity> page(long page, long size) {
        Page<InventoryFlowEntity> result = inventoryFlowMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<InventoryFlowEntity>()
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

    /** 批次库存流水 */
    public List<InventoryFlowEntity> listByBatch(String batchId) {
        return inventoryFlowMapper.selectList(new LambdaQueryWrapper<InventoryFlowEntity>()
                .eq(InventoryFlowEntity::getBatchId, batchId)
                .orderByDesc(InventoryFlowEntity::getCreatedAt));
    }

    /** 出库：写流水并计算变动前后库存 */
    @Transactional
    public InventoryFlowEntity outbound(String batchId, BigDecimal qty, String operatorId,
                                        String relatedOrderNo) {
        List<InventoryFlowEntity> history = listByBatch(batchId);
        BigDecimal before = BigDecimal.ZERO;
        for (InventoryFlowEntity flow : history) {
            if (flow.getQty() != null) {
                before = before.add(flow.getQty());
            }
        }
        BigDecimal delta = (qty == null ? BigDecimal.ZERO : qty).negate();
        InventoryFlowEntity flow = new InventoryFlowEntity();
        flow.setFlowId(ProduceIds.newId("INVF"));
        flow.setBatchId(batchId);
        flow.setFlowType(2);
        flow.setQty(delta);
        flow.setUnit("kg");
        flow.setBeforeQty(before);
        flow.setAfterQty(before.add(delta));
        flow.setOperatorId(operatorId);
        flow.setRelatedOrderNo(relatedOrderNo);
        inventoryFlowMapper.insert(flow);
        return flow;
    }
}
