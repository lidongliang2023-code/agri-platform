package com.agri.admin.controller;

import com.agri.admin.service.AnnouncementService;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.entity.Announcement;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

/** 运营端：平台公告。 */
@Tag(name = "公告管理")
@RestController
@RequestMapping("/admin/masterdata/announcement")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementService announcementService;

    @Operation(summary = "公告分页")
    @GetMapping
    public ApiResponse<PageResult<Announcement>> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(announcementService.page(pageNum, pageSize, status, type, keyword));
    }

    @Operation(summary = "新建公告（可立即发布）")
    @PostMapping
    public ApiResponse<Long> create(@RequestBody AnnouncementRequest request) {
        return ApiResponse.success(announcementService.create(request));
    }

    @Operation(summary = "修改公告正文")
    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody AnnouncementRequest request) {
        announcementService.update(id, request);
        return ApiResponse.success();
    }

    @Operation(summary = "发布公告")
    @PutMapping("/{id}/publish")
    public ApiResponse<Void> publish(@PathVariable Long id) {
        announcementService.publish(id);
        return ApiResponse.success();
    }

    @Operation(summary = "下线公告")
    @PutMapping("/{id}/offline")
    public ApiResponse<Void> offline(@PathVariable Long id) {
        announcementService.offline(id);
        return ApiResponse.success();
    }

    public record AnnouncementRequest(String title, String type, String content,
                                      LocalDateTime publishTime, LocalDateTime expireTime, Boolean publishNow) {
    }
}
