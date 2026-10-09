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
 * 农技知识文章（种植/植保/政策） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class KnowledgeArticleService {

    private static final String ID_PREFIX = "KNWL";

    private final KnowledgeArticleMapper knowledgeArticleMapper;

    /**
     * 分页查询。
     *
     * @param keyword title 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<KnowledgeArticleEntity> page(long page, long size, String keyword, Integer status) {
        Page<KnowledgeArticleEntity> result = knowledgeArticleMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<KnowledgeArticleEntity>()
                        .like(keyword != null && !keyword.isBlank(), KnowledgeArticleEntity::getTitle, keyword)
                        .eq(status != null, KnowledgeArticleEntity::getStatus, status)
                        .orderByDesc(KnowledgeArticleEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public KnowledgeArticleEntity detail(String id) {
        KnowledgeArticleEntity entity = knowledgeArticleMapper.selectById(id);
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
    public KnowledgeArticleEntity create(KnowledgeArticleEntity entity) {
        if (entity.getArticleId() == null || entity.getArticleId().isBlank()) {
            entity.setArticleId(ProduceIds.newId(ID_PREFIX));
        }
        knowledgeArticleMapper.insert(entity);
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
    public KnowledgeArticleEntity update(String id, KnowledgeArticleEntity entity) {
        entity.setArticleId(id);
        knowledgeArticleMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        knowledgeArticleMapper.deleteById(id);
    }

    /** 发布文章 */
    @Transactional
    public KnowledgeArticleEntity publish(String articleId) {
        KnowledgeArticleEntity article = detail(articleId);
        article.setStatus(1);
        article.setPublishAt(LocalDateTime.now());
        knowledgeArticleMapper.updateById(article);
        return article;
    }

    /** 分类文章 */
    public List<KnowledgeArticleEntity> listByCategory(String categoryCode) {
        return knowledgeArticleMapper.selectList(new LambdaQueryWrapper<KnowledgeArticleEntity>()
                .eq(categoryCode != null && !categoryCode.isBlank(),
                        KnowledgeArticleEntity::getCategoryCode, categoryCode)
                .eq(KnowledgeArticleEntity::getStatus, 1)
                .orderByDesc(KnowledgeArticleEntity::getPublishAt));
    }
}
