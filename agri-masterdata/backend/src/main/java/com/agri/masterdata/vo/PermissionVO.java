package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class PermissionVO {

    private String permissionId;

    private String permissionCode;

    private String permissionName;

    private String permissionType;

    private String permissionTypeName;

    private String parentId;

    private String permissionPath;

    private String permissionIcon;

    private String permissionUrl;

    private String component;

    private Integer sortOrder;

    private String status;

    private String statusName;

    private List<PermissionVO> children;

    private LocalDateTime createTime;
}