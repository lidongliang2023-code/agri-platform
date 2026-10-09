package com.agri.service.internal.news;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

/**
 * 资讯接口。
 */
@RestController
@RequestMapping("/api/v1/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsMapper newsMapper;

    @Data
    public static class CreateNewsRequest {
        @NotBlank(message = "标题不能为空")
        private String title;
        private String summary;
        private String content;
    }

    @GetMapping
    public ApiResponse<PageResult<NewsEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                    @RequestParam(defaultValue = "10") long size) {
        Page<NewsEntity> result = newsMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<NewsEntity>().orderByDesc(NewsEntity::getPublishedAt));
        return ApiResponse.ok(PageResult.of(result.getRecords(), result.getTotal(), page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<NewsEntity> get(@PathVariable Long id) {
        return ApiResponse.ok(newsMapper.selectById(id));
    }

    @PostMapping
    public ApiResponse<Long> create(@Valid @RequestBody CreateNewsRequest req) {
        NewsEntity news = new NewsEntity();
        news.setTitle(req.getTitle());
        news.setSummary(req.getSummary());
        news.setContent(req.getContent());
        news.setPublishedAt(LocalDateTime.now());
        newsMapper.insert(news);
        return ApiResponse.ok(news.getId());
    }
}
