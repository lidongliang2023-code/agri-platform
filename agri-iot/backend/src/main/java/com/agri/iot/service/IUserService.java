package com.agri.iot.service;

import com.agri.iot.entity.User;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface IUserService extends IService<User> {

    User getByUsername(String username);

    List<User> listByTenant(Long tenantId);

    List<User> listByRole(String role);

    boolean saveUser(User user);

    boolean updateUser(User user);

    boolean deleteUser(Long id);

    boolean changeStatus(Long id, Integer status);

    boolean resetPassword(Long id, String newPassword);
}