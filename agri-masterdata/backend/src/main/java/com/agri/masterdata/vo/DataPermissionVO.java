package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DataPermissionVO {

    private String dpId;

    private String roleId;

    private String roleName;

    private String dataScope;

    private String customDepts;

    private String dataConditions;

    private String moduleType;

    private LocalDateTime createTime;
}