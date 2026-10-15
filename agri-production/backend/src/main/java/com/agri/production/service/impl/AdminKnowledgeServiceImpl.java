package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.KnowledgeArticle;
import com.agri.production.entity.SopLibrary;
import com.agri.production.mapper.KnowledgeArticleMapper;
import com.agri.production.mapper.SopLibraryMapper;
import com.agri.production.service.IAdminKnowledgeService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * 运营端知识库 + SOP 规程库实现。
 *
 * <p>表由 schema-patch-knowledge-sop.sql 建：此前这两块的内容只存在于平台侧，
 * 本服务一张表都没有 —— 直接切过去两个页面会从"有数据"变"空列表"。</p>
 */
@Slf4j
@Service
public class AdminKnowledgeServiceImpl implements IAdminKnowledgeService {

    private static final String DEFAULT_TENANT = "2001";

    private final KnowledgeArticleMapper knowledgeArticleMapper;
    private final SopLibraryMapper sopLibraryMapper;

    public AdminKnowledgeServiceImpl(KnowledgeArticleMapper knowledgeArticleMapper,
                                     SopLibraryMapper sopLibraryMapper) {
        this.knowledgeArticleMapper = knowledgeArticleMapper;
        this.sopLibraryMapper = sopLibraryMapper;
    }

    @Override
    public PageResult<KnowledgeArticle> pageArticles(int pageNum, int pageSize, String keyword, Integer status,
                                                    String categoryCode) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<KnowledgeArticle> w = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            // 页面上的搜索框是"标题/摘要/正文"三处一起搜，而正文只有链接没有内容列 ——
            // 这里按标题 + 摘要匹配，页面自己会说明"正文未接入"
            w.and(q -> q.like(KnowledgeArticle::getTitle, kw).or().like(KnowledgeArticle::getSummary, kw));
        }
        if (status != null) {
            w.eq(KnowledgeArticle::getStatus, status);
        }
        if (categoryCode != null && !categoryCode.isBlank()) {
            w.eq(KnowledgeArticle::getCategoryCode, categoryCode.trim().toUpperCase());
        }
        w.orderByDesc(KnowledgeArticle::getPublishAt).orderByDesc(KnowledgeArticle::getId);
        Page<KnowledgeArticle> page = knowledgeArticleMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(page.getRecords(), page.getTotal(), p, s);
    }

    @Override
    public KnowledgeArticle getArticle(String articleId) {
        return requireArticle(articleId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String createArticle(Map<String, Object> payload) {
        KnowledgeArticle article = new KnowledgeArticle();
        article.setArticleCode("KNWL" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
        applyArticlePayload(article, payload);
        if (article.getTitle() == null || article.getTitle().isBlank()) {
            throw new BusinessException(400, "文章标题不能为空");
        }
        article.setStatus(article.getStatus() == null ? 0 : article.getStatus());
        article.setReadCount(0);
        article.setTenantId(DEFAULT_TENANT);
        article.setCreateTime(LocalDateTime.now());
        article.setUpdateTime(LocalDateTime.now());
        article.setDeleted(0);
        knowledgeArticleMapper.insert(article);
        log.info("新建知识库文章：{} {}", article.getArticleCode(), article.getTitle());
        return article.getArticleCode();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeArticle updateArticle(String articleId, Map<String, Object> payload) {
        KnowledgeArticle article = requireArticle(articleId);
        applyArticlePayload(article, payload);
        article.setUpdateTime(LocalDateTime.now());
        knowledgeArticleMapper.updateById(article);
        return knowledgeArticleMapper.selectById(article.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeArticle publishArticle(String articleId, Integer status) {
        KnowledgeArticle article = requireArticle(articleId);
        int target = status != null && status == 1 ? 1 : 0;
        article.setStatus(target);
        // 发布时写发布时间；下架时**不清空**历史发布时间（那是"曾经发布过"的事实）
        if (target == 1 && article.getPublishAt() == null) {
            article.setPublishAt(LocalDateTime.now());
        }
        article.setUpdateTime(LocalDateTime.now());
        knowledgeArticleMapper.updateById(article);
        log.info("知识库文章{}：{}", target == 1 ? "发布" : "下架", article.getArticleCode());
        return knowledgeArticleMapper.selectById(article.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteArticle(String articleId) {
        KnowledgeArticle article = requireArticle(articleId);
        // 逻辑删除（@TableLogic）—— 与其它域一致，物理删除会让审计链断掉
        knowledgeArticleMapper.deleteById(article.getId());
        log.info("知识库文章已逻辑删除：{}", article.getArticleCode());
        return true;
    }

    private KnowledgeArticle requireArticle(String articleId) {
        if (articleId == null || articleId.isBlank()) {
            throw new BusinessException(400, "缺少 articleId");
        }
        KnowledgeArticle article = knowledgeArticleMapper.selectOne(new LambdaQueryWrapper<KnowledgeArticle>()
                .eq(KnowledgeArticle::getArticleCode, articleId.trim()).last("LIMIT 1"));
        if (article == null) {
            throw new BusinessException(404, "文章不存在：" + articleId);
        }
        return article;
    }

    /** 只覆盖 payload 里真的带了的字段：增量更新不该把没传的字段清空 */
    private void applyArticlePayload(KnowledgeArticle article, Map<String, Object> payload) {
        if (payload == null) {
            return;
        }
        if (payload.containsKey("title")) {
            article.setTitle(str(payload.get("title")));
        }
        if (payload.containsKey("categoryCode")) {
            article.setCategoryCode(str(payload.get("categoryCode")));
        }
        if (payload.containsKey("summary")) {
            article.setSummary(str(payload.get("summary")));
        }
        if (payload.containsKey("contentUrl")) {
            article.setContentUrl(str(payload.get("contentUrl")));
        }
        if (payload.containsKey("author")) {
            article.setAuthor(str(payload.get("author")));
        }
        if (payload.containsKey("source")) {
            article.setSource(str(payload.get("source")));
        }
        if (payload.containsKey("status")) {
            Integer status = toInt(payload.get("status"));
            if (status != null) {
                article.setStatus(status == 1 ? 1 : 0);
            }
        }
    }

    @Override
    public PageResult<SopLibrary> pageSops(int pageNum, int pageSize, String keyword, Integer status) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<SopLibrary> w = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(SopLibrary::getSopName, kw).or().like(SopLibrary::getSopCode, kw));
        }
        if (status != null) {
            w.eq(SopLibrary::getStatus, status);
        }
        w.orderByDesc(SopLibrary::getCreateTime).orderByAsc(SopLibrary::getId);
        Page<SopLibrary> page = sopLibraryMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(page.getRecords(), page.getTotal(), p, s);
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static Integer toInt(Object value) {
        String text = str(value);
        if (text == null) {
            return null;
        }
        String normalized = text.endsWith(".0") ? text.substring(0, text.length() - 2) : text;
        try {
            return Integer.valueOf(normalized);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
