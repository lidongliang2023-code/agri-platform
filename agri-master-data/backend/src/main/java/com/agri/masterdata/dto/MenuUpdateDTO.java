package com.agri.masterdata.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MenuUpdateDTO {

    @Size(max = 50, message = "菜单名称长度不能超过50")
    private String menuName;

    private Long parentId;

    private Integer orderNum;

    private String path;

    private String component;

    private String menuType;

    private Integer visible;

    private String perms;

    private String icon;

    private Integer status;
}
