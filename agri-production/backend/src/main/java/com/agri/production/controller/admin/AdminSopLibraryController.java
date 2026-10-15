package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.SopLibrary;
import com.agri.production.service.IAdminKnowledgeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 运营端：SOP 规程库（{@code /api/v1/production/admin/sop}）。
 *
 * <p>页面「SOP管理」只调一条：分页列表。api 层那几个 create/update/delete/by-crop 函数
 * **没有任何页面调用**（探针把它们归入"不计入缺口"），所以这里不实现 ——
 * 真要支持编辑，届时连页面一起做。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/sop")
public class AdminSopLibraryController {

    private final IAdminKnowledgeService adminKnowledgeService;

    public AdminSopLibraryController(IAdminKnowledgeService adminKnowledgeService) {
        this.adminKnowledgeService = adminKnowledgeService;
    }

    /** 规程分页。 */
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
        return ApiResponse.success(adminKnowledgeService.pageSops(p, s, keyword, status));
    }
}
