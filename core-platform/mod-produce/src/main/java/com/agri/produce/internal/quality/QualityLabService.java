package com.agri.produce.internal.quality;

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
 * 检测机构/实验室（资质与认可范围） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class QualityLabService {

    private static final String ID_PREFIX = "LAB";

    private final QualityLabMapper qualityLabMapper;

    /**
     * 分页查询。
     *
     * @param keyword labName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<QualityLabEntity> page(long page, long size, String keyword, Integer status) {
        Page<QualityLabEntity> result = qualityLabMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<QualityLabEntity>()
                        .like(keyword != null && !keyword.isBlank(), QualityLabEntity::getLabName, keyword)
                        .eq(status != null, QualityLabEntity::getStatus, status)
                        .orderByDesc(QualityLabEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public QualityLabEntity detail(String id) {
        QualityLabEntity entity = qualityLabMapper.selectById(id);
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
    public QualityLabEntity create(QualityLabEntity entity) {
        if (entity.getLabId() == null || entity.getLabId().isBlank()) {
            entity.setLabId(ProduceIds.newId(ID_PREFIX));
        }
        qualityLabMapper.insert(entity);
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
    public QualityLabEntity update(String id, QualityLabEntity entity) {
        entity.setLabId(id);
        qualityLabMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        qualityLabMapper.deleteById(id);
    }

    /** 合作中的检测机构 */
    public List<QualityLabEntity> listActive() {
        return qualityLabMapper.selectList(new LambdaQueryWrapper<QualityLabEntity>()
                .eq(QualityLabEntity::getStatus, 1)
                .orderByAsc(QualityLabEntity::getLabCode));
    }
}
