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
 * 投入品供应商 应用服务。
 */
@Service
@RequiredArgsConstructor
public class SupplierService {

    private static final String ID_PREFIX = "SUPP";

    private final SupplierMapper supplierMapper;

    /**
     * 分页查询。
     *
     * @param keyword supplierName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<SupplierEntity> page(long page, long size, String keyword, Integer status) {
        Page<SupplierEntity> result = supplierMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<SupplierEntity>()
                        .like(keyword != null && !keyword.isBlank(), SupplierEntity::getSupplierName, keyword)
                        .eq(status != null, SupplierEntity::getStatus, status)
                        .orderByDesc(SupplierEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public SupplierEntity detail(String id) {
        SupplierEntity entity = supplierMapper.selectById(id);
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
    public SupplierEntity create(SupplierEntity entity) {
        if (entity.getSupplierId() == null || entity.getSupplierId().isBlank()) {
            entity.setSupplierId(ProduceIds.newId(ID_PREFIX));
        }
        supplierMapper.insert(entity);
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
    public SupplierEntity update(String id, SupplierEntity entity) {
        entity.setSupplierId(id);
        supplierMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        supplierMapper.deleteById(id);
    }

    /** 合作中的供应商 */
    public List<SupplierEntity> listActive() {
        return supplierMapper.selectList(new LambdaQueryWrapper<SupplierEntity>()
                .eq(SupplierEntity::getStatus, 1)
                .orderByAsc(SupplierEntity::getSupplierCode));
    }
}
