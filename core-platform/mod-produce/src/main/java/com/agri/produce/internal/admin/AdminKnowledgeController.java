package com.agri.produce.internal.admin;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 运营端：农技知识库。
 */
@RestController
@RequestMapping("/api/v1/production/admin/knowledge")
@RequiredArgsConstructor
public class AdminKnowledgeController {

    private final KnowledgeArticleService knowledgeArticleService;

    @GetMapping
    public ApiResponse<PageResult<KnowledgeArticleEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                                @RequestParam(defaultValue = "10") long size,
                                                                @RequestParam(required = false) String keyword,
                                                                @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(knowledgeArticleService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<KnowledgeArticleEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(knowledgeArticleService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody KnowledgeArticleEntity entity) {
        return ApiResponse.ok(knowledgeArticleService.create(entity).getArticleId());
    }

    @PutMapping("/{id}")
    public ApiResponse<KnowledgeArticleEntity> update(@PathVariable String id, @RequestBody KnowledgeArticleEntity entity) {
        return ApiResponse.ok(knowledgeArticleService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        knowledgeArticleService.delete(id);
        return ApiResponse.ok();
    }

    /** 发布文章 */
    @PostMapping("/{articleId}/publish")
    public ApiResponse<KnowledgeArticleEntity> publish(@PathVariable String articleId) {
        return ApiResponse.ok(knowledgeArticleService.publish(articleId));
    }

    /** 分类文章 */
    @GetMapping("/by-category")
    public ApiResponse<List<KnowledgeArticleEntity>> byCategory(@RequestParam String categoryCode) {
        return ApiResponse.ok(knowledgeArticleService.listByCategory(categoryCode));
    }
}
