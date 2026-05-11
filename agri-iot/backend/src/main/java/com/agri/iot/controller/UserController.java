package com.agri.iot.controller;

import com.agri.common.entity.ApiResponse;
import com.agri.iot.entity.User;
import com.agri.iot.service.IUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/iot/user")
@RequiredArgsConstructor
public class UserController {

    private final IUserService userService;

    @GetMapping("/list")
    public ApiResponse<List<User>> listAll() {
        return ApiResponse.success(userService.list());
    }

    @GetMapping("/tenant/{tenantId}")
    public ApiResponse<List<User>> listByTenant(@PathVariable Long tenantId) {
        return ApiResponse.success(userService.listByTenant(tenantId));
    }

    @GetMapping("/role/{role}")
    public ApiResponse<List<User>> listByRole(@PathVariable String role) {
        return ApiResponse.success(userService.listByRole(role));
    }

    @GetMapping("/{id}")
    public ApiResponse<User> getDetail(@PathVariable Long id) {
        return ApiResponse.success(userService.getById(id));
    }

    @GetMapping("/username/{username}")
    public ApiResponse<User> getByUsername(@PathVariable String username) {
        return ApiResponse.success(userService.getByUsername(username));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody User user) {
        userService.saveUser(user);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody User user) {
        user.setId(id);
        userService.updateUser(user);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        userService.deleteUser(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/status/{status}")
    public ApiResponse<Void> changeStatus(@PathVariable Long id, @PathVariable Integer status) {
        userService.changeStatus(id, status);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/reset-password")
    public ApiResponse<Void> resetPassword(@PathVariable Long id, @RequestParam String newPassword) {
        userService.resetPassword(id, newPassword);
        return ApiResponse.success();
    }
}