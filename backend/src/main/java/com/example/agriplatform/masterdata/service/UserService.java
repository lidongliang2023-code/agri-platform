package com.example.agriplatform.masterdata.service;

import com.example.agriplatform.masterdata.dto.LoginDTO;
import com.example.agriplatform.masterdata.dto.UserCreateDTO;
import com.example.agriplatform.masterdata.dto.UserDTO;
import com.example.agriplatform.masterdata.entity.User;

import java.util.List;

public interface UserService {

    User findByUsername(String username);

    String login(LoginDTO loginDTO);

    UserDTO create(UserCreateDTO createDTO);

    UserDTO update(Long id, UserCreateDTO updateDTO);

    void delete(Long id);

    UserDTO getById(Long id);

    List<UserDTO> list();
}