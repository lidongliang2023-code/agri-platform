package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.KnowledgeArticle;
import com.agri.production.entity.SopLibrary;

import java.util.Map;

/**
 * 运营端「知识库」与「SOP 规程库」（/api/v1/production/admin/knowledge 与 /admin/sop）。
 *
 * <p>同一口径：**不做租户过滤**、不调 TenantContextService（理由见 {@link IAdminTraceService}）。</p>
 */
public interface IAdminKnowledgeService {

    /** 知识库文章分页（keyword 匹配标题/摘要，status 1 已发布 0 草稿，categoryCode 分类）。 */
    PageResult<KnowledgeArticle> pageArticles(int pageNum, int pageSize, String keyword, Integer status,
                                             String categoryCode);

    /** 文章详情。 */
    KnowledgeArticle getArticle(String articleId);

    /** 新建文章，返回文章编号。 */
    String createArticle(Map<String, Object> payload);

    /** 更新文章（只改传了的字段）。 */
    KnowledgeArticle updateArticle(String articleId, Map<String, Object> payload);

    /**
     * 发布 / 下架：{@code status 1} 置为已发布（同时写发布时间），{@code 0} 置回草稿。
     *
     * <p>页面传的就是这个 status（{@code publishKnowledgeArticle(id, status)}）。</p>
     */
    KnowledgeArticle publishArticle(String articleId, Integer status);

    /** 逻辑删除文章。 */
    boolean deleteArticle(String articleId);

    /** SOP 规程分页（keyword 匹配规程名称/编码，status 可筛）。 */
    PageResult<SopLibrary> pageSops(int pageNum, int pageSize, String keyword, Integer status);
}
