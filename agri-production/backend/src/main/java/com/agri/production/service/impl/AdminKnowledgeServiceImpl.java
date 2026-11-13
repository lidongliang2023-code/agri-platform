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
import java.util.UUID;

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
        article.setArticleCode("KNWL" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + UUID.randomUUID().toString().substring(0, 8));
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
        if (payload.containsKey("content")) article.setContent(body(payload.get("content")));
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


    @Override
    public SopLibrary getSop(String sopId) {
        return requireSop(sopId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String createSop(Map<String, Object> payload) {
        SopLibrary sop = new SopLibrary();
        applySopPayload(sop, payload);
        if (sop.getSopName() == null || sop.getSopName().isBlank()) {
            throw new BusinessException(400, "SOP名称不能为空");
        }
        if (sop.getSopCode() == null || sop.getSopCode().isBlank()) {
            sop.setSopCode("SOP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        }
        sop.setStatus(sop.getStatus() == null ? 0 : (sop.getStatus() == 1 ? 1 : 0));
        sop.setTenantId(DEFAULT_TENANT);
        sop.setCreateTime(LocalDateTime.now());
        sop.setUpdateTime(LocalDateTime.now());
        sop.setDeleted(0);
        sopLibraryMapper.insert(sop);
        return String.valueOf(sop.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SopLibrary updateSop(String sopId, Map<String, Object> payload) {
        SopLibrary sop = requireSop(sopId);
        applySopPayload(sop, payload);
        sop.setUpdateTime(LocalDateTime.now());
        sopLibraryMapper.updateById(sop);
        return sopLibraryMapper.selectById(sop.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SopLibrary publishSop(String sopId, Integer status) {
        SopLibrary sop = requireSop(sopId);
        sop.setStatus(status != null && status == 1 ? 1 : 0);
        sop.setUpdateTime(LocalDateTime.now());
        sopLibraryMapper.updateById(sop);
        return sopLibraryMapper.selectById(sop.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteSop(String sopId) {
        SopLibrary sop = requireSop(sopId);
        sopLibraryMapper.deleteById(sop.getId());
        return true;
    }

    private SopLibrary requireSop(String sopId) {
        if (sopId == null || sopId.isBlank()) throw new BusinessException(400, "缺少 sopId");
        SopLibrary sop;
        try {
            sop = sopLibraryMapper.selectById(Long.valueOf(sopId.trim()));
        } catch (NumberFormatException ex) {
            sop = null;
        }
        if (sop == null) throw new BusinessException(404, "SOP不存在：" + sopId);
        return sop;
    }

    private void applySopPayload(SopLibrary sop, Map<String, Object> payload) {
        if (payload == null) return;
        if (payload.containsKey("sopCode")) sop.setSopCode(str(payload.get("sopCode")));
        if (payload.containsKey("cropId")) sop.setCropId(str(payload.get("cropId")));
        if (payload.containsKey("sopName")) sop.setSopName(str(payload.get("sopName")));
        if (payload.containsKey("sopType")) sop.setSopType(str(payload.get("sopType")));
        if (payload.containsKey("versionNo")) sop.setVersionNo(str(payload.get("versionNo")));
        if (payload.containsKey("content")) sop.setContent(body(payload.get("content")));
        if (payload.containsKey("contentUrl")) sop.setContentUrl(str(payload.get("contentUrl")));
        if (payload.containsKey("stageSeq")) sop.setStageSeq(toInt(payload.get("stageSeq")));
        if (payload.containsKey("applicableRegion")) sop.setApplicableRegion(str(payload.get("applicableRegion")));
        if (payload.containsKey("publisher")) sop.setPublisher(str(payload.get("publisher")));
        if (payload.containsKey("status")) {
            Integer status = toInt(payload.get("status"));
            if (status != null) sop.setStatus(status == 1 ? 1 : 0);
        }
    }

    private static String body(Object value) {
        if (value != null && !(value instanceof String)) throw new BusinessException(400, "正文必须为文本");
        String text = value == null ? "" : ((String) value).replace("\r\n", "\n").replace("\r", "\n");
        if (text.length() > 100000) throw new BusinessException(400, "正文不能超过100000个字符");
        return text;
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
