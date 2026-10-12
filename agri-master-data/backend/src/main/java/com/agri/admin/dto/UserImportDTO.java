package com.agri.admin.dto;

import lombok.Data;

import java.util.List;

@Data
public class UserImportDTO {

    private Long tenantId;
    
    private List<UserImportItem> users;

    @Data
    public static class UserImportItem {
        private String username;
        private String password;
        private String realName;
        private String phone;
        private String email;
        private String userType;
        private String idCardType;
        private String idCardNo;
        private String province;
        private String city;
        private String district;
        private String address;
    }
}