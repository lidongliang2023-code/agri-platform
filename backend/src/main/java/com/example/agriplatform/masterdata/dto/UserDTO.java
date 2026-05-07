package com.example.agriplatform.masterdata.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserDTO {

    private Long id;

    private String username;

    private String realName;

    private String phone;

    private String email;

    private Integer status;

    private Long roleId;

    private String roleName;

    private Long organizationId;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}