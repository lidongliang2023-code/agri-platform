package com.agri.auth.service;

import com.agri.auth.entity.User;

import java.util.Map;

public interface IAuthService {

    Map<String, Object> login(String username, String password);

    void logout();

    Map<String, Object> register(User user);

    void changePassword(String oldPassword, String newPassword);

    void resetPassword(Long userId, String newPassword);

    User getUserInfo(String token);

    String refreshToken(String refreshToken);

    void updateUserInfo(User user);

    void deleteUser(Long userId);

    void lockUser(Long userId);

    void unlockUser(Long userId);
}
