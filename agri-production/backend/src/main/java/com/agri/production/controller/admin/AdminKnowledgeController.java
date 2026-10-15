package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.KnowledgeArticle;
import com.agri.production.service.IAdminKnowledgeService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 运营端：农技知识库（{@code /api/v1/production/admin/knowledge}）。
 *
 * <p>按页面契约 {@code api/admin/sop.ts} 实现页面真的会调的六条：分页 / 详情 / 新建 / 更新 /
 * 发布下架 / 删除。**删除也要实现**：页面有删除按钮，而 DELETE 探针默认不发（会被跳过），
 * 若不实现就会 404、由网关回退到平台侧执行 —— 平台侧删的是它自己的表，页面上会显示"删除成功"
 * 而本库的行还在（这类"回退到另一个库"的假成功最危险）。</p>
 *
 * <p>{@code {articleId}} 是**文章编号**（如 DEMO-ART-001），与平台侧把业务编号作主键一致。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/knowledge")
public class AdminKnowledgeController {

    private final IAdminKnowledgeService adminKnowledgeService;

    public AdminKnowledgeController(IAdminKnowledgeService adminKnowledgeService) {
        this.adminKnowledgeService = adminKnowledgeService;
    }

    /** 文章分页。 */
    @GetMapping
    public ApiResponse<PageResult<KnowledgeArticle>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String categoryCode) {
        String effectiveKeyword = keyword != null && !keyword.isBlank() ? keyword : title;
        return ApiResponse.success(adminKnowledgeService.pageArticles(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                effectiveKeyword, status, categoryCode));
    }

    /** 文章详情。 */
    @GetMapping("/{articleId}")
    public ApiResponse<KnowledgeArticle> detail(@PathVariable String articleId) {
        return ApiResponse.success(adminKnowledgeService.getArticle(articleId));
    }

    /** 新建文章（返回文章编号）。 */
    @PostMapping
    public ApiResponse<String> create(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.success(adminKnowledgeService.createArticle(payload));
    }

    /** 更新文章。 */
    @PutMapping("/{articleId}")
    public ApiResponse<KnowledgeArticle> update(@PathVariable String articleId,
                                               @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.success(adminKnowledgeService.updateArticle(articleId, payload));
    }

    /** 发布 / 下架（body {status}：1 发布，0 下架）。 */
    @PatchMapping("/{articleId}/publish")
    public ApiResponse<KnowledgeArticle> publish(@PathVariable String articleId,
                                                @RequestBody(required = false) Map<String, Object> payload) {
        Integer status = null;
        if (payload != null && payload.get("status") != null) {
            try {
                status = Integer.valueOf(String.valueOf(payload.get("status")).trim());
            } catch (NumberFormatException ignored) {
                status = null;
            }
        }
        return ApiResponse.success(adminKnowledgeService.publishArticle(articleId, status));
    }

    /** 逻辑删除文章。 */
    @DeleteMapping("/{articleId}")
    public ApiResponse<Boolean> delete(@PathVariable String articleId) {
        return ApiResponse.success(adminKnowledgeService.deleteArticle(articleId));
    }

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }
}
