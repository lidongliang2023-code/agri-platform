package com.example.agriplatform.masterdata.service.impl;

import com.example.agriplatform.common.JwtUtil;
import com.example.agriplatform.masterdata.dto.LoginDTO;
import com.example.agriplatform.masterdata.dto.UserCreateDTO;
import com.example.agriplatform.masterdata.dto.UserDTO;
import com.example.agriplatform.masterdata.entity.Role;
import com.example.agriplatform.masterdata.entity.User;
import com.example.agriplatform.masterdata.mapper.RoleMapper;
import com.example.agriplatform.masterdata.mapper.UserMapper;
import com.example.agriplatform.masterdata.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserServiceImpl implements UserService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private RoleMapper roleMapper;

    @Autowired
    private JwtUtil jwtUtil;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public User findByUsername(String username) {
        return userMapper.selectByUsername(username);
    }

    @Override
    public String login(LoginDTO loginDTO) {
        User user = userMapper.selectByUsername(loginDTO.getUsername());
        if (user == null || !passwordEncoder.matches(loginDTO.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("用户名或密码错误");
        }
        if (user.getStatus() != 1) {
            throw new IllegalArgumentException("用户已禁用");
        }
        return jwtUtil.generateToken(user.getUsername());
    }

    @Override
    public UserDTO create(UserCreateDTO createDTO) {
        User existing = userMapper.selectByUsername(createDTO.getUsername());
        if (existing != null) {
            throw new IllegalArgumentException("用户名已存在");
        }

        User user = new User();
        user.setUsername(createDTO.getUsername());
        user.setPassword(passwordEncoder.encode(createDTO.getPassword()));
        user.setRealName(createDTO.getRealName());
        user.setPhone(createDTO.getPhone());
        user.setEmail(createDTO.getEmail());
        user.setStatus(createDTO.getStatus() != null ? createDTO.getStatus() : 1);
        user.setRoleId(createDTO.getRoleId());
        user.setOrganizationId(createDTO.getOrganizationId());
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());

        userMapper.insert(user);
        return convertToDTO(user);
    }

    @Override
    public UserDTO update(Long id, UserCreateDTO updateDTO) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }

        if (updateDTO.getUsername() != null && !updateDTO.getUsername().equals(user.getUsername())) {
            User existing = userMapper.selectByUsername(updateDTO.getUsername());
            if (existing != null && !existing.getId().equals(id)) {
                throw new IllegalArgumentException("用户名已存在");
            }
            user.setUsername(updateDTO.getUsername());
        }

        if (updateDTO.getPassword() != null && !updateDTO.getPassword().isEmpty()) {
            user.setPassword(passwordEncoder.encode(updateDTO.getPassword()));
        }

        if (updateDTO.getRealName() != null) {
            user.setRealName(updateDTO.getRealName());
        }
        if (updateDTO.getPhone() != null) {
            user.setPhone(updateDTO.getPhone());
        }
        if (updateDTO.getEmail() != null) {
            user.setEmail(updateDTO.getEmail());
        }
        if (updateDTO.getStatus() != null) {
            user.setStatus(updateDTO.getStatus());
        }
        if (updateDTO.getRoleId() != null) {
            user.setRoleId(updateDTO.getRoleId());
        }
        if (updateDTO.getOrganizationId() != null) {
            user.setOrganizationId(updateDTO.getOrganizationId());
        }
        user.setUpdatedAt(LocalDateTime.now());

        userMapper.updateById(user);
        return convertToDTO(user);
    }

    @Override
    public void delete(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }
        userMapper.deleteById(id);
    }

    @Override
    public UserDTO getById(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }
        return convertToDTO(user);
    }

    @Override
    public List<UserDTO> list() {
        return userMapper.selectList(null).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    private UserDTO convertToDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setRealName(user.getRealName());
        dto.setPhone(user.getPhone());
        dto.setEmail(user.getEmail());
        dto.setStatus(user.getStatus());
        dto.setRoleId(user.getRoleId());
        dto.setOrganizationId(user.getOrganizationId());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());

        if (user.getRoleId() != null) {
            Role role = roleMapper.selectById(user.getRoleId());
            if (role != null) {
                dto.setRoleName(role.getName());
            }
        }

        return dto;
    }
}