package com.agri.produce.internal.admin;

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
 * SOP 标准作业规程库（按作物/阶段下发） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class SopLibraryService {

    private static final String ID_PREFIX = "SOP";

    private final SopLibraryMapper sopLibraryMapper;

    /**
     * 分页查询。
     *
     * @param keyword sopName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<SopLibraryEntity> page(long page, long size, String keyword, Integer status) {
        Page<SopLibraryEntity> result = sopLibraryMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<SopLibraryEntity>()
                        .like(keyword != null && !keyword.isBlank(), SopLibraryEntity::getSopName, keyword)
                        .eq(status != null, SopLibraryEntity::getStatus, status)
                        .orderByDesc(SopLibraryEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public SopLibraryEntity detail(String id) {
        SopLibraryEntity entity = sopLibraryMapper.selectById(id);
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
    public SopLibraryEntity create(SopLibraryEntity entity) {
        if (entity.getSopId() == null || entity.getSopId().isBlank()) {
            entity.setSopId(ProduceIds.newId(ID_PREFIX));
        }
        sopLibraryMapper.insert(entity);
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
    public SopLibraryEntity update(String id, SopLibraryEntity entity) {
        entity.setSopId(id);
        sopLibraryMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        sopLibraryMapper.deleteById(id);
    }

    /** 按作物取已发布规程 */
    public List<SopLibraryEntity> listByCrop(String cropId) {
        return sopLibraryMapper.selectList(new LambdaQueryWrapper<SopLibraryEntity>()
                .eq(cropId != null && !cropId.isBlank(), SopLibraryEntity::getCropId, cropId)
                .eq(SopLibraryEntity::getStatus, 1)
                .orderByAsc(SopLibraryEntity::getStageSeq));
    }

    /** 发布规程 */
    @Transactional
    public SopLibraryEntity publish(String sopId) {
        SopLibraryEntity sop = detail(sopId);
        sop.setStatus(1);
        sopLibraryMapper.updateById(sop);
        return sop;
    }
}
