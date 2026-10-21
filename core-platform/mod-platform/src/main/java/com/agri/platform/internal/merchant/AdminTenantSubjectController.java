package com.agri.platform.internal.merchant;

import com.agri.core.infra.tenant.TenantSubjectProvider;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 运营端经营主体租户主档。
 *
 * <p>一个企业或个人经营主体就是一个租户，故该接口不接受独立“新建租户”：
 * 租户只能由注册/创建经营主体的业务流程产生。</p>
 */
@RestController
@RequestMapping({"/api/v1/admin/subjects", "/api/v1/admin/tenant-subjects"})
@RequiredArgsConstructor
public class AdminTenantSubjectController {

    private final TenantSubjectProvider tenantSubjectProvider;

    @GetMapping
    public ApiResponse<PageResult<TenantSubjectProvider.TenantSubject>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String memberType) {
        return ApiResponse.ok(tenantSubjectProvider.page(page, size, keyword, status, memberType));
    }

    @GetMapping("/{tenantId}")
    public ApiResponse<TenantSubjectProvider.TenantSubject> detail(@PathVariable Long tenantId) {
        return ApiResponse.ok(tenantSubjectProvider.findById(tenantId));
    }

    @PutMapping("/{tenantId}")
    public ApiResponse<TenantSubjectProvider.TenantSubject> update(
            @PathVariable Long tenantId,
            @RequestBody TenantSubjectProvider.TenantSubjectUpdate request) {
        return ApiResponse.ok(tenantSubjectProvider.update(tenantId, request));
    }

    @PutMapping("/{tenantId}/status")
    public ApiResponse<TenantSubjectProvider.TenantSubject> updateStatus(
            @PathVariable Long tenantId,
            @RequestBody StatusRequest request) {
        return ApiResponse.ok(tenantSubjectProvider.update(
                tenantId,
                new TenantSubjectProvider.TenantSubjectUpdate(null, null, null, null, null, request.status())));
    }

    public record StatusRequest(Integer status) {
    }
}
