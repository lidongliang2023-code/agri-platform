package com.agri.admin.controller;

import com.agri.admin.service.IAdminOrgService;
import com.agri.admin.vo.OrgAuditVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.OrganizationSaveDTO;
import com.agri.masterdata.vo.OrganizationVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "组织管理")
@RestController
@RequestMapping("/admin/masterdata/org")
@RequiredArgsConstructor
public class AdminOrgController {

    private final IAdminOrgService adminOrgService;

    @Operation(summary = "获取组织列表")
    @GetMapping("/list")
    public ApiResponse<PageResult<OrganizationVO>> getOrgList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String orgName,
            @RequestParam(required = false) String orgType,
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) Integer status) {
        return ApiResponse.success(adminOrgService.getOrgList(
                pageNum, pageSize, keyword, orgName, orgType, tenantId, status));
    }

    @Operation(summary = "获取组织树")
    @GetMapping("/tree")
    public ApiResponse<List<OrganizationVO>> getOrgTree(@RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminOrgService.getOrgTree(tenantId));
    }

    @Operation(summary = "获取组织详情")
    @GetMapping("/detail/{id}")
    public ApiResponse<OrganizationVO> getOrgDetail(@PathVariable Long id) {
        return ApiResponse.success(adminOrgService.getOrgDetail(id));
    }

    @Operation(summary = "创建组织")
    @PostMapping
    public ApiResponse<Long> createOrg(@Valid @RequestBody OrganizationSaveDTO dto) {
        return ApiResponse.success(adminOrgService.createOrg(dto));
    }

    @Operation(summary = "编辑组织")
    @PutMapping("/{id}")
    public ApiResponse<Void> updateOrg(@PathVariable Long id, @Valid @RequestBody OrganizationSaveDTO dto) {
        adminOrgService.updateOrg(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "启用或停用组织")
    @PutMapping("/{id}/status")
    public ApiResponse<Void> updateOrgStatus(@PathVariable Long id, @RequestParam Integer status) {
        adminOrgService.updateOrgStatus(id, status);
        return ApiResponse.success();
    }

    @Operation(summary = "删除组织")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteOrg(@PathVariable Long id) {
        adminOrgService.deleteOrg(id);
        return ApiResponse.success();
    }

    @Operation(summary = "获取组织认证审核列表（历史兼容，组织不再作为认证对象）")
    @GetMapping("/cert-audit")
    public ApiResponse<PageResult<OrgAuditVO>> getOrgCertAuditList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String authStatus) {
        return ApiResponse.success(adminOrgService.getOrgCertAuditList(pageNum, pageSize, authStatus));
    }

    @Operation(summary = "组织认证审核（历史兼容，请使用统一主体认证）")
    @PutMapping("/cert-audit/{id}")
    public ApiResponse<Void> reviewOrgCert(@PathVariable Long id, @RequestParam String authStatus, @RequestParam(required = false) String auditNote) {
        adminOrgService.reviewOrgCert(id, authStatus, auditNote);
        return ApiResponse.success();
    }
}
