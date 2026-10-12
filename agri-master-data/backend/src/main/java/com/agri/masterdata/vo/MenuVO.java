package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class MenuVO {

    private Long id;

    private String menuName;

    private Long parentId;

    private Integer orderNum;

    private String path;

    private String component;

    private String menuType;

    private String menuTypeName;

    private Integer visible;

    private Integer status;

    private String perms;

    private String icon;

    private List<MenuVO> children;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String remark;
}
