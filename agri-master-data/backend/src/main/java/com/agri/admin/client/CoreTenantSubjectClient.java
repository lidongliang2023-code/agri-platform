package com.agri.admin.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

/**
 * 核心平台经营主体租户主档。
 *
 * <p>主数据端不维护第二套租户表：企业/个人经营主体在哪里创建，
 * 主数据租户列表就读取哪里。</p>
 */
@FeignClient(name = "coreTenantSubjectClient", url = "${services.platform.url}")
public interface CoreTenantSubjectClient {

    @GetMapping("/api/v1/admin/subjects")
    CoreApiResponse<CorePageResult<CoreTenantSubject>> page(
            @RequestParam("page") long page,
            @RequestParam("size") long size,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "status", required = false) Integer status,
            @RequestParam(value = "memberType", required = false) String memberType);

    @GetMapping("/api/v1/admin/subjects/{tenantId}")
    CoreApiResponse<CoreTenantSubject> detail(@PathVariable("tenantId") Long tenantId);

    @PutMapping("/api/v1/admin/subjects/{tenantId}")
    CoreApiResponse<CoreTenantSubject> update(@PathVariable("tenantId") Long tenantId,
                                              @RequestBody TenantSubjectUpdate request);

    @PutMapping("/api/v1/admin/subjects/{tenantId}/status")
    CoreApiResponse<CoreTenantSubject> updateStatus(@PathVariable("tenantId") Long tenantId,
                                                    @RequestBody TenantStatusUpdate request);

    record TenantSubjectUpdate(String tenantName, String industry, String businessType,
                               String contactName, String contactPhone, Integer status) {
    }

    record TenantStatusUpdate(Integer status) {
    }

    record CoreTenantSubject(
            Long tenantId,
            String tenantCode,
            String tenantName,
            String memberType,
            String industry,
            String businessType,
            String contactName,
            String contactPhone,
            Integer status,
            String verifyStatus,
            String createdAt) {
    }

    record CorePageResult<T>(List<T> records, long total, long page, long size) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record CoreApiResponse<T>(Integer code, String message, T data) {
    }
}
