package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.SopLibrary;
import com.agri.production.service.IAdminKnowledgeService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 运营端生产 SOP 规程库：规程主数据归生产域维护，模型能力归 AI 中台。 */
@RestController
@RequestMapping("/api/v1/production/admin/sop")
public class AdminSopLibraryController {
    private final IAdminKnowledgeService service;

    public AdminSopLibraryController(IAdminKnowledgeService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageResult<SopLibrary>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        int p = pageNum != null ? pageNum : (page != null ? page : 1);
        int s = pageSize != null ? pageSize : (size != null ? size : 10);
        return ApiResponse.success(service.pageSops(p, s, keyword, status));
    }

    @GetMapping("/{sopId}")
    public ApiResponse<SopLibrary> detail(@PathVariable String sopId) {
        return ApiResponse.success(service.getSop(sopId));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.success(service.createSop(payload));
    }

    @PutMapping("/{sopId}")
    public ApiResponse<SopLibrary> update(@PathVariable String sopId,
                                          @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.success(service.updateSop(sopId, payload));
    }

    @PatchMapping("/{sopId}/publish")
    public ApiResponse<SopLibrary> publish(@PathVariable String sopId,
                                           @RequestBody(required = false) Map<String, Object> payload) {
        Integer status = null;
        if (payload != null && payload.get("status") != null) {
            try { status = Integer.valueOf(String.valueOf(payload.get("status"))); }
            catch (NumberFormatException ignored) { }
        }
        return ApiResponse.success(service.publishSop(sopId, status));
    }

    @DeleteMapping("/{sopId}")
    public ApiResponse<Boolean> delete(@PathVariable String sopId) {
        return ApiResponse.success(service.deleteSop(sopId));
    }
}
