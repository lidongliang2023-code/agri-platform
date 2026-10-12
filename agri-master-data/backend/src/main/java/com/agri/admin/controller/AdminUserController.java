package com.agri.admin.controller;

import com.agri.admin.dto.UserImportDTO;
import com.agri.admin.service.IAdminUserService;
import com.agri.admin.vo.UserAuditVO;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.UserAuthReviewDTO;
import com.agri.masterdata.dto.UserSaveDTO;
import com.agri.masterdata.dto.UserUpdateDTO;
import com.agri.masterdata.vo.UserVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "用户管理")
@RestController
@RequestMapping("/admin/masterdata/user")
@RequiredArgsConstructor
public class AdminUserController {

    private final IAdminUserService adminUserService;

    @Operation(summary = "获取用户列表")
    @GetMapping("/list")
    public ApiResponse<PageResult<UserVO>> getUserList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String userType,
            @RequestParam(required = false) String realNameStatus,
            @RequestParam(required = false) String userStatus,
            @RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminUserService.getUserList(pageNum, pageSize, username, phone, email, userType, realNameStatus, userStatus, tenantId));
    }

    @Operation(summary = "获取用户详情")
    @GetMapping("/detail/{id}")
    public ApiResponse<UserVO> getUserDetail(@PathVariable Long id) {
        return ApiResponse.success(adminUserService.getUserDetail(id));
    }

    @Operation(summary = "创建用户")
    @PostMapping
    public ApiResponse<Void> createUser(@RequestBody UserSaveDTO dto) {
        adminUserService.createUser(dto);
        return ApiResponse.success();
    }

    @Operation(summary = "编辑用户")
    @PutMapping("/{id}")
    public ApiResponse<Void> updateUser(@PathVariable Long id, @RequestBody UserUpdateDTO dto) {
        adminUserService.updateUser(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "删除用户")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteUser(@PathVariable Long id) {
        adminUserService.deleteUser(id);
        return ApiResponse.success();
    }

    @Operation(summary = "冻结/解冻用户")
    @PutMapping("/{id}/status")
    public ApiResponse<Void> updateUserStatus(@PathVariable Long id, @RequestParam String userStatus) {
        adminUserService.updateUserStatus(id, userStatus);
        return ApiResponse.success();
    }

    @Operation(summary = "获取实名认证审核列表")
    @GetMapping("/cert-audit")
    public ApiResponse<PageResult<UserAuditVO>> getCertAuditList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String authStatus) {
        return ApiResponse.success(adminUserService.getCertAuditList(pageNum, pageSize, authStatus));
    }

    @Operation(summary = "实名认证审核")
    @PutMapping("/cert-audit/{id}")
    public ApiResponse<Void> reviewCert(@PathVariable Long id, @RequestBody UserAuthReviewDTO dto) {
        adminUserService.reviewCert(id, dto);
        return ApiResponse.success();
    }

    @Operation(summary = "批量导入用户")
    @PostMapping("/import")
    public ApiResponse<ApiResponse.BatchResult> importUsers(@RequestBody UserImportDTO dto) {
        return ApiResponse.success(adminUserService.importUsers(dto));
    }

    @Operation(summary = "导出用户")
    @GetMapping("/export")
    public ApiResponse<byte[]> exportUsers(
            @RequestParam(required = false) String userStatus,
            @RequestParam(required = false) String tenantId) {
        return ApiResponse.success(adminUserService.exportUsers(userStatus, tenantId));
    }
}