package com.agri.auth.controller;

import com.agri.auth.entity.User;
import com.agri.auth.service.IAuthService;
import com.agri.common.result.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final IAuthService authService;

    public AuthController(IAuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");
        Map<String, Object> result = authService.login(username, password);
        return ApiResponse.success("登录成功", result);
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        authService.logout();
        return ApiResponse.success("退出成功");
    }

    @PostMapping("/register")
    public ApiResponse<Map<String, Object>> register(@RequestBody User user) {
        Map<String, Object> result = authService.register(user);
        return ApiResponse.success("注册成功", result);
    }

    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(@RequestBody Map<String, String> request) {
        String oldPassword = request.get("oldPassword");
        String newPassword = request.get("newPassword");
        authService.changePassword(oldPassword, newPassword);
        return ApiResponse.success("密码修改成功");
    }

    @PostMapping("/reset-password/{userId}")
    public ApiResponse<Void> resetPassword(@PathVariable Long userId, @RequestBody Map<String, String> request) {
        String newPassword = request.get("newPassword");
        authService.resetPassword(userId, newPassword);
        return ApiResponse.success("密码重置成功");
    }

    @GetMapping("/user-info")
    public ApiResponse<User> getUserInfo() {
        User user = authService.getUserInfo(null);
        return ApiResponse.success(user);
    }

    @PostMapping("/refresh-token")
    public ApiResponse<Map<String, Object>> refreshToken(@RequestBody Map<String, String> request) {
        String refreshToken = request.get("refreshToken");
        String token = authService.refreshToken(refreshToken);
        Map<String, Object> result = Map.of("token", token);
        return ApiResponse.success(result);
    }

    @PutMapping("/user-info")
    public ApiResponse<Void> updateUserInfo(@RequestBody User user) {
        authService.updateUserInfo(user);
        return ApiResponse.success("信息更新成功");
    }

    @DeleteMapping("/users/{userId}")
    public ApiResponse<Void> deleteUser(@PathVariable Long userId) {
        authService.deleteUser(userId);
        return ApiResponse.success("删除成功");
    }

    @PostMapping("/users/{userId}/lock")
    public ApiResponse<Void> lockUser(@PathVariable Long userId) {
        authService.lockUser(userId);
        return ApiResponse.success("锁定成功");
    }

    @PostMapping("/users/{userId}/unlock")
    public ApiResponse<Void> unlockUser(@PathVariable Long userId) {
        authService.unlockUser(userId);
        return ApiResponse.success("解锁成功");
    }
}
