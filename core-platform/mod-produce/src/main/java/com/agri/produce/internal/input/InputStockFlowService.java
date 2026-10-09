package com.agri.produce.internal.input;

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
 * 投入品库存流水 应用服务。
 */
@Service
@RequiredArgsConstructor
public class InputStockFlowService {

    private static final String ID_PREFIX = "ISFL";

    private final InputStockFlowMapper inputStockFlowMapper;

    /**
     * 分页查询。
     *
     * @return 分页结果
     */
    public PageResult<InputStockFlowEntity> page(long page, long size) {
        Page<InputStockFlowEntity> result = inputStockFlowMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<InputStockFlowEntity>()
                        .orderByDesc(InputStockFlowEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public InputStockFlowEntity detail(String id) {
        InputStockFlowEntity entity = inputStockFlowMapper.selectById(id);
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
    public InputStockFlowEntity create(InputStockFlowEntity entity) {
        if (entity.getFlowId() == null || entity.getFlowId().isBlank()) {
            entity.setFlowId(ProduceIds.newId(ID_PREFIX));
        }
        inputStockFlowMapper.insert(entity);
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
    public InputStockFlowEntity update(String id, InputStockFlowEntity entity) {
        entity.setFlowId(id);
        inputStockFlowMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        inputStockFlowMapper.deleteById(id);
    }

    /** 投入品流水 */
    public List<InputStockFlowEntity> listByInput(String inputId) {
        return inputStockFlowMapper.selectList(new LambdaQueryWrapper<InputStockFlowEntity>()
                .eq(InputStockFlowEntity::getInputId, inputId)
                .orderByDesc(InputStockFlowEntity::getCreatedAt));
    }
}
