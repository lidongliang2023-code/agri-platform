package com.agri.admin.controller;

import com.agri.admin.service.BlacklistService;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.entity.BlacklistRecord;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

/** 运营端：平台级黑名单。 */
@Tag(name = "黑名单管理")
@RestController
@RequestMapping("/admin/masterdata/blacklist")
@RequiredArgsConstructor
public class BlacklistController {

    private final BlacklistService blacklistService;

    @Operation(summary = "黑名单分页")
    @GetMapping
    public ApiResponse<PageResult<BlacklistRecord>> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(blacklistService.page(pageNum, pageSize, targetType, status, keyword));
    }

    @Operation(summary = "加入黑名单")
    @PostMapping
    public ApiResponse<Long> create(@RequestBody BlacklistRequest request) {
        return ApiResponse.success(blacklistService.create(request));
    }

    @Operation(summary = "解除黑名单")
    @PutMapping("/{id}/release")
    public ApiResponse<Void> release(@PathVariable Long id, @RequestParam(required = false) String reason) {
        blacklistService.release(id, reason);
        return ApiResponse.success();
    }

    /** 登记请求；expireTime 为空表示永久。 */
    public record BlacklistRequest(String targetType, String targetId, String targetName,
                                   String reason, String evidence, LocalDateTime startTime,
                                   LocalDateTime expireTime) {
    }
}
