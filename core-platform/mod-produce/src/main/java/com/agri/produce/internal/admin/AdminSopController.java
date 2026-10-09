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
 * 运营端：标准作业规程库。
 */
@RestController
@RequestMapping("/api/v1/production/admin/sop")
@RequiredArgsConstructor
public class AdminSopController {

    private final SopLibraryService sopLibraryService;

    @GetMapping
    public ApiResponse<PageResult<SopLibraryEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                          @RequestParam(defaultValue = "10") long size,
                                                          @RequestParam(required = false) String keyword,
                                                          @RequestParam(required = false) Integer status) {
        return ApiResponse.ok(sopLibraryService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<SopLibraryEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(sopLibraryService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody SopLibraryEntity entity) {
        return ApiResponse.ok(sopLibraryService.create(entity).getSopId());
    }

    @PutMapping("/{id}")
    public ApiResponse<SopLibraryEntity> update(@PathVariable String id, @RequestBody SopLibraryEntity entity) {
        return ApiResponse.ok(sopLibraryService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        sopLibraryService.delete(id);
        return ApiResponse.ok();
    }

    /** 按作物查规程 */
    @GetMapping("/by-crop")
    public ApiResponse<List<SopLibraryEntity>> byCrop(@RequestParam String cropId) {
        return ApiResponse.ok(sopLibraryService.listByCrop(cropId));
    }

    /** 发布规程 */
    @PostMapping("/{sopId}/publish")
    public ApiResponse<SopLibraryEntity> publish(@PathVariable String sopId) {
        return ApiResponse.ok(sopLibraryService.publish(sopId));
    }
}
