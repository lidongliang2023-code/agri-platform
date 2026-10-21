package com.agri.service.internal.news;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 官网门户公开资讯：只读，避免把管理端新增资讯接口暴露为匿名写入口。 */
@RestController
@RequestMapping("/api/v1/public/news")
@RequiredArgsConstructor
public class PublicNewsController {

    private final NewsMapper newsMapper;

    @GetMapping
    public ApiResponse<PageResult<NewsEntity>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "6") long size,
            @RequestParam(required = false) String keyword) {
        Page<NewsEntity> result = newsMapper.selectPage(new Page<>(page, Math.min(size, 50)),
                new LambdaQueryWrapper<NewsEntity>()
                        .like(keyword != null && !keyword.isBlank(), NewsEntity::getTitle, keyword)
                        .orderByDesc(NewsEntity::getPublishedAt));
        return ApiResponse.ok(PageResult.of(result.getRecords(), result.getTotal(), page, size));
    }
}
