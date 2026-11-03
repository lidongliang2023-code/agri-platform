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
 * 核心平台统一用户与“用户×经营主体”绑定。
 *
 * <p>主数据运营端只读这里的数据，不再维护 agri_md_user 这套平行账号。</p>
 */
@FeignClient(name = "coreUserAdminClient", url = "${services.platform.url}")
public interface CoreUserAdminClient {

    @GetMapping("/api/v1/admin/users")
    CoreApiResponse<CorePage<CoreUser>> pageUsers(
            @RequestParam("page") long page,
            @RequestParam("size") long size,
            @RequestParam(value = "keyword", required = false) String keyword);

    @PutMapping("/api/v1/admin/users/{id}/status")
    CoreApiResponse<Void> updateStatus(@PathVariable("id") Long id,
                                       @RequestBody UserStatusUpdate request);

    @GetMapping("/api/v1/admin/user-merchants")
    CoreApiResponse<CorePage<CoreMembership>> pageMemberships(
            @RequestParam("pageNum") long pageNum,
            @RequestParam("pageSize") long pageSize);

    @GetMapping("/api/v1/admin/user-merchants")
    CoreApiResponse<CorePage<CoreMembership>> pageMembershipsByMerchant(
            @RequestParam("pageNum") long pageNum,
            @RequestParam("pageSize") long pageSize,
            @RequestParam("merchantId") Long merchantId);

    @JsonIgnoreProperties(ignoreUnknown = true)
    record CoreUser(
            Long id,
            String username,
            String nickname,
            String phone,
            String email,
            Integer status,
            String createdAt,
            String updatedAt) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record CoreMembership(
            Long id,
            Long userId,
            Long merchantId,
            String merchantName,
            String merchantType,
            String memberType,
            String verifyStatus,
            String roleInMerchant,
            Integer status,
            String createdAt) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record CorePage<T>(List<T> records, long total, long page, long size) {
    }

    record UserStatusUpdate(Integer status) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record CoreApiResponse<T>(Integer code, String message, T data) {
    }
}
